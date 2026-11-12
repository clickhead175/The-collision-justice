import type { Metadata } from 'next';
import Link from 'next/link';
import FaqAccordion from '@/components/ui/faq-accordion';
import { Reveal } from '@/components/ui/motion';
import { FAQS, SITE_URL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Motor Vehicle Accident FAQs',
  description: 'Find answers about accident documentation, claim support, status checks, and what to expect after an MVA.',
  alternates: { canonical: '/faq' },
  openGraph: { title: 'MVA Claim FAQs', description: 'Answers to common motor vehicle accident questions.', url: `${SITE_URL}/faq` },
};

export default function FaqPage() {
  return <main className="cjir-content-page">
    <Reveal as="section" className="cjir-page-banner"><div className="cjir-site-container"><span className="cjir-section-kicker">FAQ</span><h1>Questions, answered</h1><p>Helpful information about starting a claim-support request and organizing accident details.</p></div></Reveal>
    <Reveal as="section" className="cjir-site-container cjir-faq-page-content"><FaqAccordion items={FAQS} /><div className="cjir-inline-cta"><p>Need help with your next step?</p><Link className="cjir-primary-link" href="/contact">Contact our team <span aria-hidden="true">→</span></Link></div></Reveal>
  </main>;
}