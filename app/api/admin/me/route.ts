import { NextRequest, NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const admin = await currentAdmin(request);
    if (!admin) return NextResponse.json({ message: 'Authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({
      admin: {
        id: String(admin._id), email: admin.email, name: admin.name, role: admin.role,
        isTwoFactorEnabled: admin.isTwoFactorEnabled, createdAt: admin.createdAt,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ message: 'Admin service is temporarily unavailable.' }, { status: 503 });
  }
}