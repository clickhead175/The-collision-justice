import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { requireAdminRole } from '@/lib/admin';
import { csrfIsValid } from '@/lib/csrf';
import { ClaimLead } from '@/models/ClaimLead';
import { connectToDatabase } from '@/lib/mongodb';
import { readJson } from '@/lib/request';
import { adminClaimUpdateSchema } from '@/lib/validation';
import { isDevAdminPreviewEnabled, updateDevAdminClaim } from '@/lib/dev-admin-preview';

export const runtime = 'nodejs';
type RouteContext = { params: Promise<{ claimId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    await requireAdminRole(request, ['superadmin', 'admin']);
    const { claimId } = await params;
    if (!/^TCJ-\d{5}$/.test(claimId)) throw new ApiError(404, 'Claim not found.');
    const input = adminClaimUpdateSchema.parse(await readJson(request, 48 * 1024));
    if (isDevAdminPreviewEnabled()) {
      const claim = updateDevAdminClaim(claimId, input);
      if (!claim) throw new ApiError(404, 'Claim not found.');
      return NextResponse.json({ claim: { claimId: claim.claimId, status: claim.status, internalNotes: claim.internalNotes } }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    await connectToDatabase();
    const update: Record<string, string> = {};
    if (input.status) update.status = input.status;
    if (input.internalNotes !== undefined) update.internalNotes = input.internalNotes;
    const claim = await ClaimLead.findOneAndUpdate({ claimId }, { $set: update }, { returnDocument: 'after', runValidators: true }).select('claimId status internalNotes');
    if (!claim) throw new ApiError(404, 'Claim not found.');
    return NextResponse.json({ claim }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    await requireAdminRole(request, ['superadmin', 'admin']);
    const { claimId } = await params;
    if (!/^TCJ-\d{5}$/.test(claimId)) throw new ApiError(404, 'Claim not found.');
    if (isDevAdminPreviewEnabled()) throw new ApiError(409, 'Local preview records cannot be deleted.');
    await connectToDatabase();
    const result = await ClaimLead.deleteOne({ claimId });
    if (!result.deletedCount) throw new ApiError(404, 'Claim not found.');
    return NextResponse.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
