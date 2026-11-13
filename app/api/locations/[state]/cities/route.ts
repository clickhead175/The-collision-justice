import { NextResponse } from 'next/server';
import { STATES } from '@/lib/brand';
import { isUsStateCode, getUsCities } from '@/lib/us-cities.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const stateCode = state.toUpperCase();
  if (!isUsStateCode(stateCode)) {
    return NextResponse.json({ message: 'Invalid state code.' }, { status: 400 });
  }

  try {
    const cities = await getUsCities(stateCode);
    return NextResponse.json(
      { state: stateCode, stateName: STATES.find(([code]) => code === stateCode)?.[1], cities },
      { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } },
    );
  } catch (error) {
    console.error('Failed to load US city data:', error instanceof Error ? error.message : 'UnknownError');
    return NextResponse.json({ message: 'City data is temporarily unavailable.' }, { status: 500 });
  }
}
