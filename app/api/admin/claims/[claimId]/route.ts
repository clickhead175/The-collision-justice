import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { requireAdminRole } from '@/lib/admin';
import { buildAdminClaimUpdates } from '@/lib/admin-claim-edit';
import { assertCanEditClaim, createClaimAuditChanges } from '@/lib/claim-audit';
import { csrfIsValid } from '@/lib/csrf';
import { ClaimAudit } from '@/models/ClaimAudit';
import { ClaimLead } from '@/models/ClaimLead';
import { connectToDatabase } from '@/lib/mongodb';
import { readJson } from '@/lib/request';
import { adminClaimUpdateSchema } from '@/lib/validation';
import {
  findDevAdminClaim,
  getDevAdminClaimAudit,
  isDevAdminPreviewEnabled,
  updateDevAdminClaim,
} from '@/lib/dev-admin-preview';

export const runtime = 'nodejs';
type RouteContext = { params: Promise<{ claimId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdminRole(request, ['superadmin', 'admin', 'viewer']);
    const { claimId } = await params;
    if (!/^TCJ-\d{5}$/.test(claimId)) throw new ApiError(404, 'Claim not found.');
    if (isDevAdminPreviewEnabled()) {
      const claim = findDevAdminClaim(claimId);
      if (!claim) throw new ApiError(404, 'Claim not found.');
      return NextResponse.json({ claim, auditHistory: getDevAdminClaimAudit(claimId) }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    await connectToDatabase();
    const [claim, auditHistory] = await Promise.all([
      ClaimLead.findOne({ claimId }).select('-__v').lean(),
      ClaimAudit.find({ claimId }).sort({ changedAt: -1 }).limit(100).lean(),
    ]);
    if (!claim) throw new ApiError(404, 'Claim not found.');
    return NextResponse.json({ claim, auditHistory }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const admin = await requireAdminRole(request, ['superadmin', 'admin']);
    assertCanEditClaim(admin.role);
    const { claimId } = await params;
    if (!/^TCJ-\d{5}$/.test(claimId)) throw new ApiError(404, 'Claim not found.');
    const input = adminClaimUpdateSchema.parse(await readJson(request, 48 * 1024));

    if (isDevAdminPreviewEnabled()) {
      const current = findDevAdminClaim(claimId);
      if (!current) throw new ApiError(404, 'Claim not found.');
      const updates = await buildAdminClaimUpdates(input, current.claimantCity || current.city, current.claimantState || current.state);
      const result = updateDevAdminClaim(claimId, updates, {
        actorId: String(admin._id),
        actorEmail: admin.email,
        actorRole: admin.role,
      });
      if (!result) throw new ApiError(404, 'Claim not found.');
      return NextResponse.json({ claim: result.claim, auditEvent: result.auditEvent }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    await connectToDatabase();
    const session = await ClaimLead.startSession();
    let updatedClaim: Record<string, unknown> | null = null;
    let auditEvent: Record<string, unknown> | null = null;
    try {
      await session.withTransaction(async () => {
        const current = await ClaimLead.findOne({ claimId }).session(session);
        if (!current) throw new ApiError(404, 'Claim not found.');
        const updates = await buildAdminClaimUpdates(input, current.claimantCity || current.city, current.claimantState || current.state);
        const previousValues = Object.fromEntries(Object.keys(updates).map((field) => [field, current.get(field)]));
        const changes = createClaimAuditChanges(previousValues, updates);
        current.set(updates);
        await current.save({ session });
        updatedClaim = current.toObject() as Record<string, unknown>;

        if (changes.length) {
          const [event] = await ClaimAudit.create([{
            claimId,
            actorId: String(admin._id),
            actorEmail: admin.email,
            actorRole: admin.role,
            changedAt: new Date(),
            changes,
          }], { session });
          auditEvent = event.toObject() as Record<string, unknown>;
        }
      });
    } finally {
      await session.endSession();
    }
    if (!updatedClaim) throw new ApiError(404, 'Claim not found.');
    return NextResponse.json({ claim: updatedClaim, auditEvent }, { headers: { 'Cache-Control': 'private, no-store' } });
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
