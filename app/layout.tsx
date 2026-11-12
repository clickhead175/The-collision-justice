import type { Metadata } from 'next';
import { BRAND, SITE_URL } from '@/lib/brand';
import SiteShell from '@/components/sections/site-shell';
import CustomCursor from '@/components/ui/custom-cursor';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'The Collision Justice | MVA Claim Support',
    template: '%s | The Collision Justice',
  },
  description: 'Clear guidance and claim support after a motor vehicle accident. Get help understanding next steps, gathering documents, and moving your claim forward.',
  applicationName: BRAND.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    title: 'The Collision Justice | MVA Claim Support',
    description: 'Real human support and clear next steps after a motor vehicle accident.',
    url: SITE_URL,
    images: [{ url: '/home-crashed-car.png', width: 1200, height: 630, alt: 'The Collision Justice accident support' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Collision Justice | MVA Claim Support',
    description: 'Real human support and clear next steps after a motor vehicle accident.',
    images: ['/home-crashed-car.png'],
  },
  robots: { index: true, follow: true },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'LegalService',
  name: BRAND.name,
  url: SITE_URL,
  email: BRAND.email,
  telephone: BRAND.phone,
  address: { '@type': 'PostalAddress', ...BRAND.address },
  areaServed: { '@type': 'Country', name: 'United States' },
  description: 'Motor vehicle accident claim support and legal marketing services. Not a law firm.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US" data-scroll-behavior="smooth">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
        <CustomCursor />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}