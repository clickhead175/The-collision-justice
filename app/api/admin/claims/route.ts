import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { currentAdmin, requireAdminRole } from '@/lib/admin';
import { ACCIDENT_TYPES, CLAIM_STATUSES, STATES } from '@/lib/brand';
import { csrfIsValid } from '@/lib/csrf';
import { getClaimRequestMetadata, extractTrustedFormCertId } from '@/lib/claim-request-metadata';
import { ClaimLead } from '@/models/ClaimLead';
import { connectToDatabase } from '@/lib/mongodb';
import { getDevAdminClaimsPage, isDevAdminPreviewEnabled } from '@/lib/dev-admin-preview';
import { readJson } from '@/lib/request';
import { claimInputSchema } from '@/lib/validation';
import { createClaimLocationMetadata } from '@/lib/claim-location';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!await currentAdmin(request)) throw new ApiError(401, 'Authentication required.');
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Math.min(10000, Number.parseInt(params.get('page') || '1', 10) || 1));
    const search = (params.get('search') || '').trim().slice(0, 40);
    const status = params.get('status') || '';
    const state = params.get('state') || '';
    const accidentType = params.get('accidentType') || '';
    if (status && !CLAIM_STATUSES.includes(status as typeof CLAIM_STATUSES[number])) throw new ApiError(422, 'Invalid claim status.');
    if (state && !STATES.some(([code]) => code === state)) throw new ApiError(422, 'Invalid state.');
    if (accidentType && !ACCIDENT_TYPES.includes(accidentType as typeof ACCIDENT_TYPES[number])) throw new ApiError(422, 'Invalid accident type.');
    if (isDevAdminPreviewEnabled()) {
      return NextResponse.json(getDevAdminClaimsPage({ page, search, status, state, accidentType, limit: 30 }), { headers: { 'Cache-Control': 'private, no-store' } });
    }
    await connectToDatabase();
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (state) filter.state = state;
    if (accidentType) filter.accidentType = accidentType;
    if (search) filter.claimId = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const limit = 30;
    const [claims, totalClaims, newIntakes, pendingDocs, filed, filteredCount] = await Promise.all([
      ClaimLead.find(filter).select('-__v').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ClaimLead.countDocuments(),
      ClaimLead.countDocuments({ status: 'New Intake' }),
      ClaimLead.countDocuments({ status: 'Reviewing Docs' }),
      ClaimLead.countDocuments({ status: 'Filed' }),
      ClaimLead.countDocuments(filter),
    ]);
    return NextResponse.json({ claims, totalClaims, newIntakes, pendingDocs, filed, page, lastPage: Math.max(1, Math.ceil(filteredCount / limit)) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRole(request, ['superadmin', 'admin']);
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const input = claimInputSchema.parse(await readJson(request));
    const {
      xxTrustedFormToken,
      website: _website,
      clientIp: _clientIp,
      cityIsManual: _cityIsManual,
      trustedFormCertId: _submittedCertId,
      ...claimData
    } = input;
    if (isDevAdminPreviewEnabled()) throw new ApiError(409, 'Local preview records cannot be created.');
    await connectToDatabase();
    let claimId: string | null = null;
    let claimStatus = 'New Intake';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const claim = await ClaimLead.create({
          ...claimData,
          ...createClaimLocationMetadata(claimData.city, claimData.state),
          ...await getClaimRequestMetadata(request.headers),
          trustedFormCertId: extractTrustedFormCertId(claimData.trustedFormCertUrl, xxTrustedFormToken),
          claimId: `TCJ-${randomInt(10000, 100000)}`,
          accidentDate: new Date(`${input.accidentDate}T12:00:00.000Z`),
          consentTimestamp: new Date(),
          status: 'New Intake',
        });
        claimId = claim.claimId;
        claimStatus = claim.status;
        break;
      } catch (error) {
        if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) || attempt === 4) throw error;
      }
    }
    if (!claimId) throw new Error('Unable to allocate claim ID.');
    return NextResponse.json({ claim: { claimId, status: claimStatus } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
