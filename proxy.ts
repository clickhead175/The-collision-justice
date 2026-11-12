import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === '/admin/login';
  const isDevPreview = process.env.NODE_ENV === 'development'
    && process.env.DEV_BYPASS_ADMIN_AUTH === 'true'
    && !process.env.MONGODB_URI?.trim();
  if (pathname === '/api/admin/login' || pathname === '/api/admin/2fa/verify') return NextResponse.next();
  if (isDevPreview) return NextResponse.next();
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  let valid = false;
  if (token) {
    try {
      await verifyAdminToken(token);
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (pathname.startsWith('/api/admin/')) {
    if (!valid) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
    return NextResponse.next();
  }

  if (!isLoginPage && !valid) {
    const login = new URL('/admin/login', request.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }
  if (isLoginPage) return NextResponse.next();
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};