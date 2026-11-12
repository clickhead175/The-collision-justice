import type { Metadata } from 'next';
import AdminWorkspace from '@/components/admin/admin-workspace';
import { isDevAdminPreviewEnabled } from '@/lib/dev-admin-preview';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE } from '@/lib/auth';
import { adminForSessionToken } from '@/lib/admin';

export const metadata: Metadata = {
  title: 'Claim Admin Dashboard',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!isDevAdminPreviewEnabled()) {
    const cookieStore = await cookies();
    if (!await adminForSessionToken(cookieStore.get(ADMIN_COOKIE)?.value)) redirect('/admin/login');
  }
  return <AdminWorkspace devPreview={isDevAdminPreviewEnabled()} />;
}