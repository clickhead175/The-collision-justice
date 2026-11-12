import { verify } from 'otplib';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { currentAdmin } from '@/lib/admin';
import { decryptAdminSecret } from '@/lib/auth';
import { csrfIsValid } from '@/lib/csrf';
import { Admin } from '@/models/Admin';
import { connectToDatabase } from '@/lib/mongodb';
import { readJson } from '@/lib/request';
import { adminTotpCodeSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const admin = await currentAdmin(request);
    if (!admin) throw new ApiError(401, 'Authentication required.');
    const body = await readJson(request);
    const code = adminTotpCodeSchema.parse(typeof body === 'object' && body !== null && 'code' in body ? body.code : '');
    await connectToDatabase();
    const account = await Admin.findById(admin._id).select('+pendingTwoFactorSecret isTwoFactorEnabled sessionVersion');
    if (!account || account.isTwoFactorEnabled || !account.pendingTwoFactorSecret) throw new ApiError(409, 'Start two-factor setup before confirming.');
    const secret = decryptAdminSecret(account.pendingTwoFactorSecret);
    if (!(await verify({ secret, token: code })).valid) throw new ApiError(422, 'The authenticator code is incorrect.');
    account.twoFactorSecret = account.pendingTwoFactorSecret;
    account.pendingTwoFactorSecret = undefined;
    account.isTwoFactorEnabled = true;
    account.sessionVersion += 1;
    await account.save();
    return NextResponse.json({ enabled: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
