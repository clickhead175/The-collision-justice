import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { verifyClaimTrustedFormAttachmentToken } from '@/lib/auth';
import { createClaimAuditChanges } from '@/lib/claim-audit';
import { csrfIsValid } from '@/lib/csrf';
import { connectToDatabase } from '@/lib/mongodb';
import { readJson } from '@/lib/request';
import { rateLimit } from '@/lib/rate-limit';
import { ClaimAudit } from '@/models/ClaimAudit';
import { ClaimLead } from '@/models/ClaimLead';
import { extractTrustedFormCertId } from '@/lib/claim-request-metadata';
import { trustedFormCertificateAttachSchema } from '@/lib/validation';

export const runtime = 'nodejs';
type RouteContext = { params: Promise<{ claimId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const { claimId } = await params;
    if (!/^TCJ-\d{5}$/.test(claimId)) throw new ApiError(404, 'Claim not found.');
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!token) throw new ApiError(403, 'Not authorized.');
    let tokenClaimId: string;
    try {
      tokenClaimId = await verifyClaimTrustedFormAttachmentToken(token);
    } catch {
      throw new ApiError(403, 'Not authorized.');
    }
    if (tokenClaimId !== claimId) throw new ApiError(403, 'Not authorized.');
    const input = trustedFormCertificateAttachSchema.parse(await readJson(request, 8 * 1024));
    const trustedFormCertId = extractTrustedFormCertId(input.trustedFormCertUrl, '');
    if (!trustedFormCertId) throw new ApiError(422, 'Invalid TrustedForm certificate URL.');
    if (!await rateLimit('trustedform-attach', claimId, 5, 60 * 60 * 1000)) {
      throw new ApiError(429, 'Too many certificate attachment attempts.');
    }
    await connectToDatabase();

    const session = await ClaimLead.startSession();
    let attached = false;
    try {
      await session.withTransaction(async () => {
        const claim = await ClaimLead.findOne({ claimId }).session(session);
        if (!claim) throw new ApiError(404, 'Claim not found.');
        if (claim.trustedFormCertUrl === input.trustedFormCertUrl && claim.trustedFormCertId === trustedFormCertId) {
          attached = true;
          return;
        }
        if (claim.trustedFormCertUrl || claim.trustedFormCertId) {
          throw new ApiError(409, 'A TrustedForm certificate is already attached to this claim.');
        }

        const fields = {
          trustedFormCertUrl: input.trustedFormCertUrl,
          trustedFormCertId,
          trustedFormPingUrl: input.trustedFormPingUrl,
          trustedFormVerificationStatus: 'pending' as const,
          trustedFormVerificationAttempts: 0,
          trustedFormVerificationLastAttemptAt: undefined,
          trustedFormVerificationNextAttemptAt: new Date(),
          trustedFormVerificationError: 'pending_validation',
        };
        const previousValues = {
          trustedFormCertUrl: claim.trustedFormCertUrl ?? null,
          trustedFormCertId: claim.trustedFormCertId ?? null,
          trustedFormPingUrl: claim.trustedFormPingUrl ?? null,
          trustedFormVerificationStatus: claim.trustedFormVerificationStatus,
          trustedFormVerificationAttempts: claim.trustedFormVerificationAttempts,
          trustedFormVerificationNextAttemptAt: claim.trustedFormVerificationNextAttemptAt,
          trustedFormVerificationError: claim.trustedFormVerificationError,
        };
        claim.set(fields);
        await claim.save({ session });
        const changes = createClaimAuditChanges(previousValues, fields);
        await ClaimAudit.create([{
          claimId,
          actorId: 'system:trustedform-certify',
          actorEmail: 'TrustedForm Certify callback',
          actorRole: 'system',
          changedAt: new Date(),
          changes,
        }], { session });
        attached = true;
      });
    } finally {
      await session.endSession();
    }

    if (!attached) throw new ApiError(409, 'The certificate could not be attached to this claim.');
    return NextResponse.json({ attached: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
