import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { claimInputSchema } from '@/lib/validation';
import { ApiError, apiError } from '@/lib/api-error';
import { csrfIsValid } from '@/lib/csrf';
import { connectToDatabase } from '@/lib/mongodb';
import { ClaimLead } from '@/models/ClaimLead';
import { rateLimit, requestIdentity } from '@/lib/rate-limit';
import { readJson } from '@/lib/request';
import { signClaimPdfToken } from '@/lib/auth';
import { extractTrustedFormCertId, getClaimRequestMetadata } from '@/lib/claim-request-metadata';
import type { ClaimReceipt } from '@/types/claims';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh the page and try again.');
    if (!await rateLimit('claim-intake', requestIdentity(request), 5, 60 * 60 * 1000)) {
      throw new ApiError(429, 'Too many requests. Please try again later.');
    }
    const input = claimInputSchema.parse(await readJson(request));
    const {
      xxTrustedFormToken: _xxTrustedFormToken,
      clientIp,
      trustedFormCertId: _submittedCertId,
      website: _website,
      ...claimData
    } = input;
    const requestMetadata = getClaimRequestMetadata(request.headers, claimData, clientIp);
    const trustedFormCertId = extractTrustedFormCertId(claimData.trustedFormCertUrl, '');
    await connectToDatabase();
    let claim;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const claimId = `TCJ-${randomInt(10000, 100000)}`;
      try {
        claim = await ClaimLead.create({
          ...claimData,
          ...requestMetadata,
          trustedFormCertId,
          claimId,
          accidentDate: new Date(`${input.accidentDate}T12:00:00.000Z`),
          consentTimestamp: new Date(),
          status: 'New Intake',
        });
        break;
      } catch (error) {
        if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) || attempt === 4) throw error;
      }
    }
    if (!claim) throw new Error('Unable to allocate claim ID.');
    const pdfToken = await signClaimPdfToken(claim.claimId);
    const receipt: ClaimReceipt = {
      claimId: claim.claimId,
      status: claim.status,
      pdfUrl: `/api/claims/${claim.claimId}/pdf?token=${encodeURIComponent(pdfToken)}`,
    };
    return NextResponse.json(receipt, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}