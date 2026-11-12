import type { Metadata } from 'next';
import AdminLoginForm from '@/components/admin/admin-login-form';

export const metadata: Metadata = {
  title: 'Admin Sign In',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return <AdminLoginForm />;
}