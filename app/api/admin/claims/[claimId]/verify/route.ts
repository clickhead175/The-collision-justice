import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { requireAdminRole } from '@/lib/admin';
import { assertCanEditClaim } from '@/lib/claim-audit';
import { csrfIsValid } from '@/lib/csrf';
import { findDevAdminClaim, isDevAdminPreviewEnabled } from '@/lib/dev-admin-preview';
import { connectToDatabase } from '@/lib/mongodb';
import { rateLimit } from '@/lib/rate-limit';
import {
  recordTrustedFormValidation,
  validateTrustedFormCertificate,
} from '@/lib/trustedform-verification.server';
import { ClaimLead } from '@/models/ClaimLead';

export const runtime = 'nodejs';
type RouteContext = { params: Promise<{ claimId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const admin = await requireAdminRole(request, ['superadmin', 'admin']);
    assertCanEditClaim(admin.role);
    const { claimId } = await params;
    if (!/^TCJ-\d{5}$/.test(claimId)) throw new ApiError(404, 'Claim not found.');

    if (isDevAdminPreviewEnabled()) {
      if (!findDevAdminClaim(claimId)) throw new ApiError(404, 'Claim not found.');
      throw new ApiError(409, 'Local preview records do not contain real TrustedForm certificates.');
    }

    if (!await rateLimit('trustedform-validation', String(admin._id), 10, 60 * 60 * 1000)) {
      throw new ApiError(429, 'Too many verification attempts. Please try again later.');
    }
    await connectToDatabase();
    const claim = await ClaimLead.findOne({ claimId }).select('trustedFormCertId trustedFormVerificationStatus trustedFormVerificationAttempts');
    if (!claim) throw new ApiError(404, 'Claim not found.');
    if (!claim.trustedFormCertId) throw new ApiError(409, 'This claim has no TrustedForm certificate to validate.');
    if (claim.trustedFormVerificationStatus !== 'pending') {
      throw new ApiError(409, 'Only pending TrustedForm certificates can be checked again.');
    }

    const validation = await validateTrustedFormCertificate(claim.trustedFormCertId);
    const fields = await recordTrustedFormValidation(claimId, claim.trustedFormVerificationAttempts || 0, validation, {
      actorId: String(admin._id),
      actorEmail: admin.email,
      actorRole: admin.role,
    }, 0);
    if (!fields) throw new ApiError(409, 'The verification status changed. Reload the claim and try again.');
    return NextResponse.json({ verification: fields }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
