import { NextRequest, NextResponse } from 'next/server';
import { getClaimRequestMetadata } from '@/lib/claim-request-metadata';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const metadata = await getClaimRequestMetadata(request.headers);
  const ip = metadata.ipAddress || 'Unavailable';
  const location = metadata.geoLocation || 'Unavailable';

  return NextResponse.json({ ip, location }, { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}