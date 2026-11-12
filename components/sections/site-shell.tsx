'use client';

import { usePathname } from 'next/navigation';
import SiteFooter from '@/components/sections/site-footer';
import SiteHeader from '@/components/sections/site-header';

export default function SiteShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');
  return <>{!isAdmin && <SiteHeader />}{children}{!isAdmin && <SiteFooter />}</>;
}