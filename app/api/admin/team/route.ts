import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { requireAdminRole } from '@/lib/admin';
import { assertCanCreateAdminRole } from '@/lib/admin-permissions';
import { Admin } from '@/models/Admin';
import { connectToDatabase } from '@/lib/mongodb';
import { csrfIsValid } from '@/lib/csrf';
import { readJson } from '@/lib/request';
import { adminTeamCreateSchema } from '@/lib/validation';
import { isDevAdminPreviewEnabled } from '@/lib/dev-admin-preview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdminRole(request, ['superadmin', 'admin']);
    if (isDevAdminPreviewEnabled()) return NextResponse.json({ members: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
    await connectToDatabase();
    const members = await Admin.find().select('name email role isTwoFactorEnabled createdAt').sort({ createdAt: 1 }).lean();
    return NextResponse.json({ members }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdminRole(request, ['superadmin', 'admin']);
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const input = adminTeamCreateSchema.parse(await readJson(request));
    assertCanCreateAdminRole(actor.role, input.role);
    if (isDevAdminPreviewEnabled()) throw new ApiError(409, 'Team management is unavailable in local preview.');
    await connectToDatabase();
    const member = await Admin.create({
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash: await bcrypt.hash(input.password, 12),
      createdBy: actor.email,
      sessionVersion: 0,
    });
    return NextResponse.json({
      member: { id: String(member._id), name: member.name, email: member.email, role: member.role, isTwoFactorEnabled: false },
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return NextResponse.json({ message: 'An account with that email already exists.' }, { status: 409 });
    }
    return apiError(error);
  }
}
