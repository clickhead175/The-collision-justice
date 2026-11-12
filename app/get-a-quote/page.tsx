import type { Metadata } from 'next';
import ClaimIntakeForm from '@/components/ui/claim-intake-form';
import { SITE_URL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Start Your MVA Claim Intake',
  description: 'Share details about your motor vehicle accident to receive claim-support information and practical next steps.',
  alternates: { canonical: '/get-a-quote' },
  openGraph: { title: 'Start Your Claim | The Collision Justice', description: 'Securely share a few details to get started with MVA claim support.', url: `${SITE_URL}/get-a-quote` },
};

export default async function GetAQuotePage({ searchParams }: { searchParams: Promise<{ zip?: string }> }) {
  const { zip = '' } = await searchParams;
  return <main className="cj-quote-page"><header className="cj-quote-intro"><span className="cjir-kicker">SECURE CLAIM INTAKE</span><h1>Tell us what happened</h1><p>Share a few details and our team can help you understand common next steps. It usually takes a few minutes.</p></header><section><ClaimIntakeForm initialZip={zip} /></section></main>;
}