import bcrypt from 'bcryptjs';
import { verify } from 'otplib';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { currentAdmin } from '@/lib/admin';
import { decryptAdminSecret } from '@/lib/auth';
import { csrfIsValid } from '@/lib/csrf';
import { Admin } from '@/models/Admin';
import { connectToDatabase } from '@/lib/mongodb';
import { readJson } from '@/lib/request';
import { adminTwoFactorDisableSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const identity = await currentAdmin(request);
    if (!identity) throw new ApiError(401, 'Authentication required.');
    const input = adminTwoFactorDisableSchema.parse(await readJson(request));
    await connectToDatabase();
    const admin = await Admin.findById(identity._id).select('+passwordHash +twoFactorSecret sessionVersion');
    if (!admin || !await bcrypt.compare(input.currentPassword, admin.passwordHash)) {
      throw new ApiError(403, 'Current password is incorrect.');
    }
    if (!admin.isTwoFactorEnabled || !admin.twoFactorSecret) throw new ApiError(409, 'Two-factor authentication is not enabled.');
    const secret = decryptAdminSecret(admin.twoFactorSecret);
    if (!(await verify({ secret, token: input.code })).valid) throw new ApiError(403, 'The authenticator code is incorrect.');
    admin.isTwoFactorEnabled = false;
    admin.twoFactorSecret = undefined;
    admin.pendingTwoFactorSecret = undefined;
    admin.sessionVersion += 1;
    await admin.save();
    return NextResponse.json({ enabled: false, reauthenticate: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
