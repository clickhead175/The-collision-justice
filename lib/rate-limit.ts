import { createHmac } from 'node:crypto';
import { connectToDatabase } from '@/lib/mongodb';
import { RateLimit } from '@/models/RateLimit';

export async function rateLimit(scope: string, identity: string, limit: number, windowMs: number) {
  await connectToDatabase();
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('JWT_SECRET is not configured.');
  const key = createHmac('sha256', secret).update(`${scope}:${identity}`).digest('hex');
  const filter = { key, windowStart };
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt: new Date(windowStart + windowMs * 2) },
  };

  try {
    const record = await RateLimit.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: false });
    return record.count <= limit;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      const record = await RateLimit.findOneAndUpdate(filter, { $inc: { count: 1 } }, { returnDocument: 'after' });
      return Boolean(record && record.count <= limit);
    }
    throw error;
  }
}

function scopedRateLimitKey(scope: string, identity: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('JWT_SECRET is not configured.');
  return createHmac('sha256', secret).update(`${scope}:${identity}`).digest('hex');
}

export async function isAdminAuthLocked(scope: 'admin-login-failed' | 'admin-2fa-failed', identity: string) {
  await connectToDatabase();
  const windowMs = 15 * 60 * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const record = await RateLimit.findOne({ key: scopedRateLimitKey(scope, identity), windowStart }).select('count').lean();
  return (record?.count || 0) >= 5;
}

export async function recordAdminAuthFailure(scope: 'admin-login-failed' | 'admin-2fa-failed', identity: string) {
  await connectToDatabase();
  const windowMs = 15 * 60 * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const key = scopedRateLimitKey(scope, identity);
  let record;
  try {
    record = await RateLimit.findOneAndUpdate(
      { key, windowStart },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + windowMs * 2) } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: false },
    );
  } catch (error) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 11000)) throw error;
    record = await RateLimit.findOneAndUpdate({ key, windowStart }, { $inc: { count: 1 } }, { returnDocument: 'after' });
  }
  return record.count >= 5;
}

export async function clearAdminAuthFailures(scope: 'admin-login-failed' | 'admin-2fa-failed', identity: string) {
  await connectToDatabase();
  const windowMs = 15 * 60 * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  await RateLimit.deleteOne({ key: scopedRateLimitKey(scope, identity), windowStart });
}

export function requestIdentity(request: Request) {
  return request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
    || 'unknown';
}