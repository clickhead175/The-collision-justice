import type { Metadata } from 'next';
import AdminSettings from '@/components/admin/admin-settings';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE } from '@/lib/auth';
import { adminForSessionToken } from '@/lib/admin';
import { isDevAdminPreviewEnabled } from '@/lib/dev-admin-preview';

export const metadata: Metadata = {
  title: 'Settings & Security',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  if (!isDevAdminPreviewEnabled()) {
    const cookieStore = await cookies();
    if (!await adminForSessionToken(cookieStore.get(ADMIN_COOKIE)?.value)) redirect('/admin/login');
  }
  return <AdminSettings />;
}
