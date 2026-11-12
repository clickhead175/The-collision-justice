import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { currentAdmin } from '@/lib/admin';
import { csrfIsValid } from '@/lib/csrf';
import { Admin } from '@/models/Admin';
import { connectToDatabase } from '@/lib/mongodb';
import { readJson } from '@/lib/request';
import { adminPasswordChangeSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const identity = await currentAdmin(request);
    if (!identity) throw new ApiError(401, 'Authentication required.');
    const input = adminPasswordChangeSchema.parse(await readJson(request));
    await connectToDatabase();
    const admin = await Admin.findById(identity._id).select('+passwordHash sessionVersion');
    if (!admin || !await bcrypt.compare(input.currentPassword, admin.passwordHash)) throw new ApiError(403, 'Current password is incorrect.');
    admin.passwordHash = await bcrypt.hash(input.newPassword, 12);
    admin.sessionVersion += 1;
    await admin.save();
    return NextResponse.json({ changed: true, reauthenticate: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
