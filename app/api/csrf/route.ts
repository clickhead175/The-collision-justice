import { NextResponse } from 'next/server';
import { newCsrfToken, setCsrfCookie } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const token = newCsrfToken();
  const response = NextResponse.json({ csrfToken: token }, { headers: { 'Cache-Control': 'no-store' } });
  setCsrfCookie(response, token);
  return response;
}