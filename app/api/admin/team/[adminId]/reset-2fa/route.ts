import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { requireAdminRole } from '@/lib/admin';
import { assertCanManageAdmin } from '@/lib/admin-permissions';
import { Admin } from '@/models/Admin';
import { connectToDatabase } from '@/lib/mongodb';
import { csrfIsValid } from '@/lib/csrf';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ adminId: string }> }) {
  try {
    await requireAdminRole(request, ['superadmin']);
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const { adminId } = await params;
    if (!mongoose.isValidObjectId(adminId)) throw new ApiError(404, 'Team member not found.');
    await connectToDatabase();
    const member = await Admin.findById(adminId).select('role');
    if (!member) throw new ApiError(404, 'Team member not found.');
    assertCanManageAdmin('superadmin', member.role, 'reset-2fa');
    const result = await Admin.updateOne(
      { _id: member._id, role: { $in: ['admin', 'viewer'] } },
      { $set: { isTwoFactorEnabled: false }, $unset: { twoFactorSecret: 1, pendingTwoFactorSecret: 1 }, $inc: { sessionVersion: 1 } },
    );
    if (!result.matchedCount) throw new ApiError(403, 'Superadmin accounts are protected and cannot be changed.');
    return NextResponse.json({ reset: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
