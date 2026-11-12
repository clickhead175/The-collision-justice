import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const CSRF_COOKIE = 'csrf-token';

export function newCsrfToken() {
  return randomBytes(32).toString('base64url');
}

export function setCsrfCookie(response: NextResponse, token: string) {
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 2,
  });
}

export function csrfIsValid(request: NextRequest) {
  const cookie = request.cookies.get(CSRF_COOKIE)?.value || '';
  const header = request.headers.get('x-csrf-token') || '';
  const cookieBytes = Buffer.from(cookie);
  const headerBytes = Buffer.from(header);
  const tokenMatches = cookieBytes.length > 0 && cookieBytes.length === headerBytes.length && timingSafeEqual(cookieBytes, headerBytes);
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  return tokenMatches;
}

export function attachCsrfCookie(response: NextResponse, token: string) {
  setCsrfCookie(response, token);
  return response;
}