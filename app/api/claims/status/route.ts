import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { signClaimPdfToken } from '@/lib/auth';
import { csrfIsValid } from '@/lib/csrf';
import { ClaimLead } from '@/models/ClaimLead';
import { connectToDatabase } from '@/lib/mongodb';
import { rateLimit, requestIdentity } from '@/lib/rate-limit';
import { readJson } from '@/lib/request';
import { claimLookupSchema, lookupEmailPattern, lookupPhonePattern } from '@/lib/validation';
import type { ClaimStatusResponse } from '@/types/claims';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh the page and try again.');
    if (!await rateLimit('claim-status', requestIdentity(request), 12, 60 * 60 * 1000)) throw new ApiError(429, 'Too many lookups. Please try again later.');
    const input = claimLookupSchema.parse(await readJson(request));
    await connectToDatabase();
    const filter = input.claimId
      ? { claimId: input.claimId }
      : input.email
        ? { email: { $regex: lookupEmailPattern(input.email) } }
        : {
          phone: { $regex: lookupPhonePattern(input.phone) },
        };
    const claim = await ClaimLead.findOne(filter)
      .sort({ createdAt: -1, _id: -1 })
      .select('claimId status createdAt firstName lastName phone email city state zipCode accidentDate accidentType injuriesReported policeReportFiled atFaultStatus description consentAgreed consentTimestamp');
    if (!claim) throw new ApiError(404, 'No claim matched those details. Check your Claim ID, email address, or phone number.');
    const pdfToken = await signClaimPdfToken(claim.claimId);
    const result: ClaimStatusResponse = {
      claimId: claim.claimId,
      status: claim.status,
      createdAt: claim.createdAt.toISOString(),
      pdfUrl: `/api/claims/${claim.claimId}/pdf?token=${encodeURIComponent(pdfToken)}`,
      details: {
        firstName: claim.firstName,
        lastName: claim.lastName,
        phone: claim.phone,
        email: claim.email,
        city: claim.city,
        state: claim.state,
        zipCode: claim.zipCode,
        accidentDate: claim.accidentDate.toISOString(),
        accidentType: claim.accidentType,
        injuriesReported: claim.injuriesReported,
        policeReportFiled: claim.policeReportFiled,
        atFaultStatus: claim.atFaultStatus,
        description: claim.description,
        consentAgreed: claim.consentAgreed,
        consentTimestamp: claim.consentTimestamp.toISOString(),
      },
    };
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}