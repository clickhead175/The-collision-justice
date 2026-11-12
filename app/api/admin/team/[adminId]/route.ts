import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { requireAdminRole } from '@/lib/admin';
import { assertCanManageAdmin } from '@/lib/admin-permissions';
import { Admin } from '@/models/Admin';
import { connectToDatabase } from '@/lib/mongodb';
import { csrfIsValid } from '@/lib/csrf';
import { readJson } from '@/lib/request';
import { adminTeamUpdateSchema } from '@/lib/validation';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ adminId: string }> };

async function targetAdmin(adminId: string) {
  if (!mongoose.isValidObjectId(adminId)) throw new ApiError(404, 'Team member not found.');
  await connectToDatabase();
  const member = await Admin.findById(adminId).select('name email role isTwoFactorEnabled sessionVersion');
  if (!member) throw new ApiError(404, 'Team member not found.');
  if (member.role === 'superadmin') throw new ApiError(403, 'Superadmin accounts are protected and cannot be changed or deleted.');
  return member;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdminRole(request, ['superadmin']);
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const input = adminTeamUpdateSchema.parse(await readJson(request));
    const { adminId } = await params;
    const member = await targetAdmin(adminId);
    assertCanManageAdmin('superadmin', member.role, 'edit');
    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.email !== undefined) update.email = input.email;
    if (input.role !== undefined) update.role = input.role;
    if (input.password !== undefined) update.passwordHash = await bcrypt.hash(input.password, 12);
    const saved = await Admin.findOneAndUpdate(
      { _id: member._id, role: { $in: ['admin', 'viewer'] } },
      { $set: update, $inc: { sessionVersion: 1 } },
      { returnDocument: 'after', runValidators: true },
    )
      .select('name email role isTwoFactorEnabled');
    if (!saved) throw new ApiError(403, 'Superadmin accounts are protected and cannot be changed or deleted.');
    return NextResponse.json({ member: saved }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return NextResponse.json({ message: 'An account with that email already exists.' }, { status: 409 });
    }
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await requireAdminRole(request, ['superadmin', 'admin']);
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const { adminId } = await params;
    const member = await targetAdmin(adminId);
    assertCanManageAdmin(actor.role, member.role, 'delete');
    const roleFilter = actor.role === 'admin' ? 'viewer' : { $in: ['admin', 'viewer'] };
    const result = await Admin.deleteOne({ _id: member._id, role: roleFilter });
    if (!result.deletedCount) throw new ApiError(403, 'Superadmin accounts are protected and cannot be changed or deleted.');
    return NextResponse.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
