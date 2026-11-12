import { verify } from 'otplib';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { decryptAdminSecret, setAdminCookie, signAdminToken, verifyTwoFactorChallenge } from '@/lib/auth';
import { csrfIsValid } from '@/lib/csrf';
import { Admin } from '@/models/Admin';
import { connectToDatabase } from '@/lib/mongodb';
import { clearAdminAuthFailures, isAdminAuthLocked, rateLimit, recordAdminAuthFailure, requestIdentity } from '@/lib/rate-limit';
import { readJson } from '@/lib/request';
import { adminTwoFactorVerifySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const input = adminTwoFactorVerifySchema.parse(await readJson(request));
    const challenge = await verifyTwoFactorChallenge(input.challenge).catch(() => null);
    if (!challenge) throw new ApiError(401, 'Your sign-in challenge expired. Please sign in again.');
    const identity = `${requestIdentity(request)}:${challenge.sub}`;
    if (await isAdminAuthLocked('admin-2fa-failed', identity)) throw new ApiError(429, 'Two-factor verification is temporarily locked. Try again in 15 minutes.');
    if (!await rateLimit('admin-2fa-verify', requestIdentity(request), 20, 15 * 60 * 1000)) {
      throw new ApiError(429, 'Too many verification attempts. Try again later.');
    }
    await connectToDatabase();
    const admin = await Admin.findById(challenge.sub)
      .select('email role sessionVersion isTwoFactorEnabled +twoFactorSecret');
    if (!admin || admin.email !== challenge.email || admin.sessionVersion !== challenge.ver || !admin.isTwoFactorEnabled || !admin.twoFactorSecret) {
      throw new ApiError(401, 'Your sign-in challenge is no longer valid.');
    }
    const secret = decryptAdminSecret(admin.twoFactorSecret);
    const result = await verify({ secret, token: input.code });
    if (!result.valid) {
      if (await recordAdminAuthFailure('admin-2fa-failed', identity)) {
        throw new ApiError(429, 'Two-factor verification is temporarily locked. Try again in 15 minutes.');
      }
      throw new ApiError(401, 'The authenticator code is incorrect.');
    }
    await clearAdminAuthFailures('admin-2fa-failed', identity);
    const rememberMe = challenge.remember === true;
    const token = await signAdminToken({
      id: String(admin._id), email: admin.email, role: admin.role, sessionVersion: admin.sessionVersion,
    }, rememberMe);
    const response = NextResponse.json({ admin: { email: admin.email, role: admin.role } }, { headers: { 'Cache-Control': 'no-store' } });
    setAdminCookie(response, token, rememberMe);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
