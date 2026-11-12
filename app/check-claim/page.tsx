import type { Metadata } from 'next';
import ClaimLookupForm from '@/components/ui/claim-lookup-form';
import { SITE_URL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Check Your Claim Status',
  description: 'Check your Collision Justice claim using your Claim ID, email address, or phone number.',
  alternates: { canonical: '/check-claim' },
  openGraph: { title: 'Check Claim Status', description: 'Check your MVA claim with your Claim ID, email address, or phone number.', url: `${SITE_URL}/check-claim` },
};

export default async function CheckClaimPage({ searchParams }: { searchParams: Promise<{ id?: string; claimId?: string }> }) {
  const { id = '', claimId = '' } = await searchParams;
  return <main className="cj-claim-lookup-page"><ClaimLookupForm initialClaimId={id || claimId} /></main>;
}