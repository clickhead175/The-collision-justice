import type { Metadata } from 'next';
import { Reveal } from '@/components/ui/motion';
import { BRAND, SITE_URL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Review the terms for using The Collision Justice website and claim-support services.',
  alternates: { canonical: '/terms' },
  openGraph: { title: 'Terms of Use', description: 'Terms for using The Collision Justice website.', url: `${SITE_URL}/terms` },
};

export default function TermsPage() {
  return <main className="cjir-content-page"><Reveal as="section" className="cjir-page-banner"><div className="cjir-site-container"><span className="cjir-section-kicker">PLEASE REVIEW</span><h1>Terms of Use</h1><p>Last updated November 12, 2026</p></div></Reveal><Reveal as="article" className="cjir-site-container cjir-legal-content">
    <h2>Informational service</h2><p>The Collision Justice is a legal marketing and claim-support information service, not a law firm, insurer, or government agency. We do not provide legal advice, determine fault, settle claims, or guarantee an outcome. No attorney-client relationship is created by visiting this site or submitting a form.</p>
    <h2>No guarantee</h2><p>Information on this site is general and may not apply to your circumstances. Claim decisions, coverage, compensation, and timelines depend on facts, policy terms, applicable law, and third parties.</p>
    <h2>Your submissions</h2><p>You agree to provide accurate information and to use this site lawfully. Do not submit another person&apos;s information without authority or send emergencies through this website. Call emergency services when immediate help is needed.</p>
    <h2>Contact and consent</h2><p>When you submit an intake, the consent language displayed with the form governs how we may contact you. Consent is not a condition of purchasing goods or services. You may withdraw consent by contacting us.</p>
    <h2>Contact</h2><p>Questions can be sent to <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>.</p>
  </Reveal></main>;
}