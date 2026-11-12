'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Check, Download, ShieldCheck } from 'lucide-react';
import { getCsrfHeaders } from '@/components/ui/csrf';
import { readApiResponse } from '@/components/ui/api-response';
import type { ClaimStatusResponse } from '@/types/claims';

const progressSteps = [
  'Claim received',
  'Specialist reviewing file',
  'Document & police report check',
  'Assigned to claim partner',
  'Claim filed & active',
  'Resolution completed',
];

type LookupInput = { claimId?: string; email?: string; phone?: string };

function normalizeClaimId(value: string) {
  const normalized = value.trim().toUpperCase().replace(/^TCJ-?/, '');
  return /^\d{5}$/.test(normalized) ? `TCJ-${normalized}` : '';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function ClaimLookupForm({ initialClaimId = '' }: { initialClaimId?: string }) {
  const [claimId, setClaimId] = useState(initialClaimId.toUpperCase());
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<ClaimStatusResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function lookup(input: LookupInput = { claimId, email, phone }) {
    const rawClaimId = input.claimId?.trim() || '';
    const normalizedClaimId = normalizeClaimId(rawClaimId);
    const lookupEmail = input.email?.trim() || '';
    const lookupPhone = input.phone?.trim() || '';
    setError('');
    setResult(null);
    if (!rawClaimId && !lookupEmail && !lookupPhone) {
      setError('Enter your Claim ID, email address, or phone number.');
      return;
    }
    if (rawClaimId && !normalizedClaimId && !lookupEmail && !lookupPhone) {
      setError('Enter a valid five-digit Claim ID from your receipt.');
      return;
    }

    setBusy(true);
    try {
      const headers = await getCsrfHeaders();
      const response = await fetch('/api/claims/status', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId: normalizedClaimId, email: lookupEmail, phone: lookupPhone }),
      });
      const body = await readApiResponse(response, 'We could not check your claim. Please try again.');
      if (typeof body.claimId !== 'string' || typeof body.status !== 'string' || typeof body.createdAt !== 'string'
        || typeof body.pdfUrl !== 'string' || typeof body.details !== 'object' || body.details === null) {
        throw new Error('The claim status response was incomplete. Please try again.');
      }
      setClaimId(body.claimId);
      setResult(body as ClaimStatusResponse);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : 'We could not check your claim. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!normalizeClaimId(initialClaimId)) return;
    setClaimId(initialClaimId.toUpperCase());
    void lookup({ claimId: initialClaimId });
  // The initial URL ID is the one-time auto-lookup input.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup();
  }

  const progressIndex = result
    ? ({ 'New Intake': 0, 'Reviewing Docs': 2, Assigned: 3, Filed: 4, Closed: 5 }[result.status] ?? 0)
    : 0;
  const details = result?.details;
  const detailRows = details ? [
    ['Submitted', formatDateTime(result.createdAt)],
    ['First Name', details.firstName],
    ['Last Name', details.lastName],
    ['Phone Number', details.phone],
    ['Email', details.email],
    ['City', details.city],
    ['State', details.state],
    ['Zipcode', details.zipCode],
    ['Accident Date', new Date(`${details.accidentDate.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { dateStyle: 'long' })],
    ['Accident Type', details.accidentType],
    ['Injuries Reported', details.injuriesReported],
    ['Police Report Filed', details.policeReportFiled],
    ['At-Fault Status', details.atFaultStatus],
    ['Additional Notes', details.description],
    ['Consent', details.consentAgreed ? 'Agreed to the Do Not Call / Contact Consent Disclaimer' : 'Not recorded'],
  ] : [];

  return <section className="cj-claim-lookup-shell">
    <header className="cj-claim-lookup-hero">
      <div className="cj-claim-lookup-brand"><ShieldCheck size={30} aria-hidden="true" /><span>The Collision Justice</span></div>
      <span className="cj-claim-lookup-eyebrow">CLAIM LOOKUP</span>
      <h1>Check your claim</h1>
      <p>Enter your Claim ID, email address, or phone number—any one of the three will pull up your claim.</p>
    </header>

    <div className="cj-claim-lookup-content">
      <section className="cj-claim-search-card" aria-label="Find a claim">
        <form onSubmit={submit}>
          <div className="cj-claim-search-row">
            <label className="cj-claim-id-field" htmlFor="claim-lookup-id">
              <span>Your Claim ID</span>
              <input id="claim-lookup-id" autoComplete="off" placeholder="TCJ-84920" value={claimId} onChange={(event) => setClaimId(event.target.value.toUpperCase())} />
            </label>
            <button type="submit" className="cj-claim-search-button" disabled={busy}>{busy ? 'Finding claim…' : 'Find my claim'}</button>
          </div>
          <p className="cj-claim-search-helper">Enter your Claim ID, Email address, or Phone number—any one of the three will pull up your claim.</p>
          <div className="cj-claim-verify-row">
            <label htmlFor="claim-lookup-email">Email address<input id="claim-lookup-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label htmlFor="claim-lookup-phone">Phone number<input id="claim-lookup-phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          </div>
          {error && <p className="cj-claim-error" role="alert">{error}</p>}
        </form>
      </section>

      {result && details && <article className="cj-claim-result" aria-live="polite">
        <header className="cj-claim-result-header">
          <div>
            <span>MVA CLAIM REQUEST</span>
            <h2>{details.firstName} {details.lastName}</h2>
            <code>{result.claimId}</code>
          </div>
          <span className="cj-claim-status-pill">{result.status}</span>
        </header>

        <div className="cj-claim-result-columns">
          <section className="cj-claim-submitted-details">
            <h3>Submitted details</h3>
            <dl>{detailRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </section>
          <aside className="cj-claim-progress" aria-label="Your claim progress">
            <h3>YOUR PROGRESS</h3>
            <ol>
              {progressSteps.map((step, index) => {
                const complete = index < progressIndex || result.status === 'Closed';
                const active = index === progressIndex && result.status !== 'Closed';
                return <li key={step} className={complete ? 'is-complete' : active ? 'is-active' : ''}>
                  <span className="cj-claim-progress-marker">{complete ? <Check size={16} strokeWidth={3} /> : active ? <span className="cj-claim-progress-dot" /> : null}</span>
                  <div><strong>{step}</strong>{index === 0 && <small>{formatDateTime(result.createdAt)}</small>}</div>
                </li>;
              })}
            </ol>
          </aside>
        </div>

        <footer className="cj-claim-result-footer">
          <div><a className="cj-claim-pdf-button" href={result.pdfUrl}><Download size={17} aria-hidden="true" />Download PDF</a><p>A copy of everything above, with your Claim ID — keep it for your records.</p></div>
          <p>Can&apos;t find your Claim ID? Email <a href="mailto:Info@thecollisionjustice.com">Info@thecollisionjustice.com</a> or call <a href="tel:+14348496895">434-849-6895</a> and we&apos;ll look it up for you.</p>
        </footer>
      </article>}
    </div>
  </section>;
}
