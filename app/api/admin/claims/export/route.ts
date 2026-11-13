import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { currentAdmin } from '@/lib/admin';
import { ClaimLead } from '@/models/ClaimLead';
import { connectToDatabase } from '@/lib/mongodb';
import { getDevAdminClaims, isDevAdminPreviewEnabled } from '@/lib/dev-admin-preview';
import { getClaimantLocation, hasVerifiedReferenceIp } from '@/lib/claim-location';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[\x00-\x20]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    if (!await currentAdmin(request)) throw new ApiError(401, 'Authentication required.');
    const rows = isDevAdminPreviewEnabled()
      ? getDevAdminClaims()
      : await (async () => {
        await connectToDatabase();
        return ClaimLead.find().sort({ createdAt: -1 }).lean();
      })();
    const columns = ['Claim ID', 'First Name', 'Last Name', 'Phone', 'Email', 'ZIP', 'City', 'State', 'Claimant City', 'Claimant State', 'Location Source', 'Verified Reference IP', 'Reference IP Geo Location', 'Original Network Organization', 'Normalized Provider', 'Reference ASN', 'Reference IP Source', 'Accident Date', 'Accident Type', 'Injuries', 'Police Report', 'Fault Status', 'Description', 'Submitter IP (not claimant IP)', 'Submitter IP Geo Location', 'TrustedForm Certificate URL', 'Lead ID', 'TrustedForm Ping URL', 'Status', 'Consent Timestamp', 'Created At', 'Internal Notes'];
    const lines = [columns.map(csvCell).join(',')];
    for (const claim of rows) {
      const claimantLocation = getClaimantLocation(claim);
      const verifiedReferenceIp = hasVerifiedReferenceIp(claim);
      lines.push([
        claim.claimId, claim.firstName, claim.lastName, claim.phone, claim.email, claim.zipCode, claim.city, claim.state,
        claimantLocation.city, claimantLocation.state, claim.locationSource,
        verifiedReferenceIp ? claim.referenceIp : 'Not available',
        verifiedReferenceIp ? claim.referenceIpGeoLocation : 'Not available',
        verifiedReferenceIp ? claim.referenceIpOrganization : 'Not available',
        verifiedReferenceIp ? claim.referenceIpProvider : 'Other / Unknown',
        verifiedReferenceIp && claim.referenceIpAsn ? `AS${claim.referenceIpAsn}` : 'Not available',
        verifiedReferenceIp ? 'Independent network allocation and geolocation verification' : 'Not available',
        claim.accidentDate.toISOString().slice(0, 10), claim.accidentType, claim.injuriesReported, claim.policeReportFiled,
        claim.atFaultStatus, claim.description, claim.ipAddress, claim.geoLocation, claim.trustedFormCertUrl, claim.trustedFormCertId, claim.trustedFormPingUrl,
        claim.status, claim.consentTimestamp.toISOString(), claim.createdAt.toISOString(), claim.internalNotes,
      ].map(csvCell).join(','));
    }
    return new NextResponse(`\uFEFF${lines.join('\r\n')}`, { headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="collision-justice-claims.csv"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    return apiError(error);
  }
}