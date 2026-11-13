import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { NextRequest, NextResponse } from 'next/server';

export const ADMIN_COOKIE = 'cj_admin';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24;
export const ADMIN_REMEMBER_TTL_SECONDS = 60 * 60 * 24 * 30;
export type AdminRole = 'superadmin' | 'admin' | 'viewer';
export type AdminSession = JWTPayload & { sub: string; email: string; role: AdminRole; ver: number };

function secretBytes() {
  const secret = process.env.JWT_SECRET || '';
  if (Buffer.byteLength(secret) < 32) throw new Error('JWT_SECRET must contain at least 32 bytes.');
  return Buffer.from(secret);
}

function deriveKey(purpose: string) {
  return createHmac('sha256', secretBytes()).update(`collision-justice:${purpose}`).digest();
}

function encode(value: Buffer) {
  return value.toString('base64url');
}

function decode(value: string) {
  return Buffer.from(value, 'base64url');
}

export async function signAdminToken(
  admin: { id: string; email: string; role: AdminRole; sessionVersion: number },
  rememberMe = false,
) {
  const ttl = rememberMe ? ADMIN_REMEMBER_TTL_SECONDS : ADMIN_SESSION_TTL_SECONDS;
  const jwt = await new SignJWT({ email: admin.email, role: admin.role, ver: admin.sessionVersion })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(deriveKey('admin-session-jwt-signing'));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey('admin-session-encryption'), iv);
  const ciphertext = Buffer.concat([cipher.update(jwt, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const signed = `v1.${encode(iv)}.${encode(ciphertext)}.${encode(tag)}`;
  const signature = createHmac('sha256', deriveKey('admin-session-signing')).update(signed).digest();
  return `${signed}.${encode(signature)}`;
}

export async function verifyAdminToken(token: string): Promise<AdminSession> {
  const [version, ivPart, ciphertextPart, tagPart, signaturePart, extra] = token.split('.');
  if (version !== 'v1' || !ivPart || !ciphertextPart || !tagPart || !signaturePart || extra) {
    throw new Error('Invalid admin session.');
  }
  const signed = [version, ivPart, ciphertextPart, tagPart].join('.');
  const expected = createHmac('sha256', deriveKey('admin-session-signing')).update(signed).digest();
  const signature = decode(signaturePart);
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    throw new Error('Invalid admin session signature.');
  }
  const decipher = createDecipheriv('aes-256-gcm', deriveKey('admin-session-encryption'), decode(ivPart));
  decipher.setAuthTag(decode(tagPart));
  const jwt = Buffer.concat([decipher.update(decode(ciphertextPart)), decipher.final()]).toString('utf8');
  const { payload } = await jwtVerify(jwt, deriveKey('admin-session-jwt-signing'), { algorithms: ['HS256'] });
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string'
    || typeof payload.role !== 'string' || !['superadmin', 'admin', 'viewer'].includes(payload.role)
    || typeof payload.ver !== 'number') {
    throw new Error('Invalid or expired admin session.');
  }
  return payload as AdminSession;
}

export function encryptAdminSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey('admin-totp-encryption'), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${encode(iv)}.${encode(cipher.getAuthTag())}.${encode(ciphertext)}`;
}

export function decryptAdminSecret(value: string) {
  const [version, ivPart, tagPart, ciphertextPart, extra] = value.split('.');
  if (version !== 'v1' || !ivPart || !tagPart || !ciphertextPart || extra) {
    throw new Error('Invalid encrypted authenticator secret.');
  }
  const decipher = createDecipheriv('aes-256-gcm', deriveKey('admin-totp-encryption'), decode(ivPart));
  decipher.setAuthTag(decode(tagPart));
  return Buffer.concat([decipher.update(decode(ciphertextPart)), decipher.final()]).toString('utf8');
}

export async function signTwoFactorChallenge(admin: { id: string; email: string; sessionVersion: number }, rememberMe: boolean) {
  return new SignJWT({ purpose: 'admin_2fa', email: admin.email, ver: admin.sessionVersion, remember: rememberMe })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secretBytes());
}

export async function verifyTwoFactorChallenge(token: string) {
  const { payload } = await jwtVerify(token, secretBytes(), { algorithms: ['HS256'] });
  if (payload.purpose !== 'admin_2fa' || typeof payload.sub !== 'string'
    || typeof payload.email !== 'string' || typeof payload.ver !== 'number') {
    throw new Error('Invalid two-factor challenge.');
  }
  return payload as JWTPayload & { sub: string; email: string; ver: number; purpose: 'admin_2fa'; remember?: boolean };
}

export async function signClaimPdfToken(claimId: string) {
  return new SignJWT({ purpose: 'claim_pdf' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claimId)
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(secretBytes());
}

export async function verifyClaimPdfToken(token: string, claimId: string) {
  const { payload } = await jwtVerify(token, secretBytes(), { algorithms: ['HS256'] });
  return payload.purpose === 'claim_pdf' && payload.sub === claimId;
}

export async function signClaimTrustedFormAttachmentToken(claimId: string) {
  return new SignJWT({ purpose: 'trustedform_attachment' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claimId)
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(secretBytes());
}

export async function verifyClaimTrustedFormAttachmentToken(token: string) {
  const { payload } = await jwtVerify(token, secretBytes(), { algorithms: ['HS256'] });
  if (payload.purpose !== 'trustedform_attachment' || typeof payload.sub !== 'string'
    || !/^TCJ-\d{5}$/.test(payload.sub)) {
    throw new Error('Invalid TrustedForm attachment token.');
  }
  return payload.sub;
}

export function setAdminCookie(response: NextResponse, token: string, rememberMe = false) {
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: rememberMe ? ADMIN_REMEMBER_TTL_SECONDS : ADMIN_SESSION_TTL_SECONDS,
  });
}

export function clearAdminCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

export async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifyAdminToken(token);
  } catch {
    return null;
  }
}
