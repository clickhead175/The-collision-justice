import type { Metadata } from 'next';
import { Reveal } from '@/components/ui/motion';
import { BRAND, SITE_URL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Read how The Collision Justice collects, uses, protects, and retains information submitted through this website.',
  alternates: { canonical: '/privacy-policy' },
  openGraph: { title: 'Privacy Policy', description: 'How we handle information submitted to The Collision Justice.', url: `${SITE_URL}/privacy-policy` },
};

export default function PrivacyPolicyPage() {
  return <main className="cjir-content-page"><Reveal as="section" className="cjir-page-banner"><div className="cjir-site-container"><span className="cjir-section-kicker">YOUR INFORMATION</span><h1>Privacy Policy</h1><p>Last updated November 12, 2026</p></div></Reveal><Reveal as="article" className="cjir-site-container cjir-legal-content">
    <h2>Information we collect</h2><p>When you submit a claim intake or contact inquiry, we collect the details you provide, which may include contact information, accident details, and consent records. To document and protect intake requests, we may also collect the IP address and approximate location associated with a submission. If ActiveProspect TrustedForm is enabled, we may collect and retain the certificate URL and certificate identifier associated with your visit. Technical information needed to protect and operate the site may also be processed.</p>
    <h2>How information is used</h2><p>We use information to review and respond to requests, provide claim-support information, maintain security, and meet legal obligations. Information is not used for a purpose incompatible with the request and consent you submitted.</p>
    <h2>Sharing and service providers</h2><p>Information may be shared with service providers that operate the site, database, communications, or support workflows, and with relevant parties when you request or authorize a connection. We do not sell personal information to unrelated third parties.</p>
    <h2>Security and retention</h2><p>We use access controls, secure transport, and encrypted storage for claim records. No online system can guarantee absolute security. We retain records only as needed for the purposes described here and applicable legal obligations.</p>
    <h2>Your choices</h2><p>You may contact us to ask about your information or request correction or deletion, subject to legal and operational requirements.</p>
    <h2>Contact</h2><p>Questions about this policy can be sent to <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a> or by phone at <a href={`tel:${BRAND.phoneHref}`}>{BRAND.phone}</a>.</p>
  </Reveal></main>;
}