import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeHeaderValue(value: string | null) {
  return value?.replace(/[\r\n\0]/g, '').slice(0, 120) || '';
}

export async function GET(request: NextRequest) {
  const forwardedIp = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for');
  const ip = safeHeaderValue(forwardedIp?.split(',')[0]?.trim() || null) || 'Unavailable';
  let city = safeHeaderValue(request.headers.get('x-vercel-ip-city'));
  try { city = decodeURIComponent(city); } catch { city = ''; }
  const region = safeHeaderValue(request.headers.get('x-vercel-ip-country-region'));
  const location = [city, region].filter(Boolean).join(', ') || 'Unavailable';

  return NextResponse.json({ ip, location }, { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}