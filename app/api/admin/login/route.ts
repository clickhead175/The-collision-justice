import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { setAdminCookie, signAdminToken, signTwoFactorChallenge } from '@/lib/auth';
import { csrfIsValid } from '@/lib/csrf';
import { Admin } from '@/models/Admin';
import { connectToDatabase } from '@/lib/mongodb';
import { clearAdminAuthFailures, isAdminAuthLocked, rateLimit, recordAdminAuthFailure, requestIdentity } from '@/lib/rate-limit';
import { readJson } from '@/lib/request';
import { adminLoginSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const credentials = adminLoginSchema.parse(await readJson(request));
    const identity = `${requestIdentity(request)}:${credentials.email}`;
    if (await isAdminAuthLocked('admin-login-failed', identity)) throw new ApiError(429, 'Sign-in is temporarily locked. Try again in 15 minutes.');
    if (!await rateLimit('admin-login', requestIdentity(request), 20, 15 * 60 * 1000)) {
      throw new ApiError(429, 'Too many sign-in attempts. Try again later.');
    }
    await connectToDatabase();
    const admin = await Admin.findOne({ email: credentials.email })
      .select('+passwordHash email name role sessionVersion isTwoFactorEnabled +twoFactorSecret');
    if (!admin || !await bcrypt.compare(credentials.password, admin.passwordHash)) {
      if (await recordAdminAuthFailure('admin-login-failed', identity)) {
        throw new ApiError(429, 'Sign-in is temporarily locked. Try again in 15 minutes.');
      }
      throw new ApiError(401, 'Unable to sign in. Check your email and password.');
    }
    if (!admin.name || !admin.role || !Number.isInteger(admin.sessionVersion) || typeof admin.isTwoFactorEnabled !== 'boolean') {
      admin.name = admin.name || admin.email;
      admin.role = admin.role || 'viewer';
      admin.sessionVersion = Number.isInteger(admin.sessionVersion) ? admin.sessionVersion : 0;
      admin.isTwoFactorEnabled = admin.isTwoFactorEnabled === true;
      await admin.save();
    }
    await clearAdminAuthFailures('admin-login-failed', identity);
    const session = { id: String(admin._id), email: admin.email, role: admin.role, sessionVersion: admin.sessionVersion };
    if (admin.isTwoFactorEnabled) {
      const challenge = await signTwoFactorChallenge(session, credentials.rememberMe);
      return NextResponse.json({ requiresTwoFactor: true, challenge }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const token = await signAdminToken(session, credentials.rememberMe);
    const response = NextResponse.json({ admin: { email: admin.email, role: admin.role } }, { headers: { 'Cache-Control': 'no-store' } });
    setAdminCookie(response, token, credentials.rememberMe);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
