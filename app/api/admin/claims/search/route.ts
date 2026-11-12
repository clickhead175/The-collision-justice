import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { currentAdmin } from '@/lib/admin';
import { ACCIDENT_TYPES, CLAIM_STATUSES, STATES } from '@/lib/brand';
import { ClaimLead } from '@/models/ClaimLead';
import { connectToDatabase } from '@/lib/mongodb';
import { getDevAdminClaimsPage, isDevAdminPreviewEnabled } from '@/lib/dev-admin-preview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!await currentAdmin(request)) throw new ApiError(401, 'Authentication required.');
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Math.min(10000, Number.parseInt(params.get('page') || '1', 10) || 1));
    const search = (params.get('search') || '').trim().slice(0, 60);
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
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { claimId: { $regex: escaped, $options: 'i' } },
        { firstName: { $regex: escaped, $options: 'i' } },
        { lastName: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { zipCode: { $regex: escaped, $options: 'i' } },
      ];
    }
    const limit = 30;
    const [claims, filteredCount, totalClaims, newIntakes, pendingDocs, filed] = await Promise.all([
      ClaimLead.find(filter).select('-__v').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ClaimLead.countDocuments(filter),
      ClaimLead.countDocuments(),
      ClaimLead.countDocuments({ status: 'New Intake' }),
      ClaimLead.countDocuments({ status: 'Reviewing Docs' }),
      ClaimLead.countDocuments({ status: 'Filed' }),
    ]);
    return NextResponse.json({ claims, totalClaims, newIntakes, pendingDocs, filed, page, lastPage: Math.max(1, Math.ceil(filteredCount / limit)) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
}