'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ACCIDENT_TYPES, STATES } from '@/lib/brand';
import { getCsrfHeaders } from '@/components/ui/csrf';
import { readApiResponse } from '@/components/ui/api-response';
import ClaimConfirmation from '@/components/ui/claim-confirmation';
import type { ClaimReceipt } from '@/types/claims';

declare global {
  interface Window {
    trustedForm?: { id?: string };
    trustedFormCertUrlCallback?: (certUrl: string, pingUrl?: string) => void;
  }
}

const TRUSTEDFORM_SCRIPT_SELECTOR = 'script[src*="trustedform.com"]';
const TRUSTEDFORM_SCRIPT_URL = 'https://api.trustedform.com/trustedform.js?field=xxTrustedFormCertUrl&use_tagged_consent=true';

let clientIpRequest: Promise<string> | undefined;

function fetchClientIp() {
  if (!clientIpRequest) {
    clientIpRequest = (async () => {
      for (const endpoint of ['https://api.ipify.org?format=json', 'https://api64.ipify.org?format=json']) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 2500);
        try {
          const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
          if (!response.ok) continue;
          const result: unknown = await response.json();
          if (typeof result === 'object' && result !== null && 'ip' in result && typeof result.ip === 'string') {
            const ip = result.ip.trim();
            if (ip && ip.length <= 45 && ip !== '127.0.0.1' && ip !== '::1') return ip;
          }
        } catch {
          continue;
        } finally {
          window.clearTimeout(timeout);
        }
      }
      return '';
    })();
  }
  return clientIpRequest;
}

function waitForClientIp(timeoutMs: number) {
  return Promise.race([
    fetchClientIp(),
    new Promise<string>((resolve) => window.setTimeout(() => resolve(''), timeoutMs)),
  ]);
}

type ClaimFields = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  zipCode: string;
  city: string;
  state: string;
  accidentDate: string;
  accidentType: string;
  injuriesReported: string;
  policeReportFiled: string;
  atFaultStatus: string;
  description: string;
  trustedFormCertUrl: string;
  xxTrustedFormToken: string;
  consentAgreed: boolean;
  website: string;
};

const emptyFields: ClaimFields = {
  firstName: '', lastName: '', phone: '', email: '', zipCode: '', city: '', state: '',
  accidentDate: '', accidentType: '', injuriesReported: '', policeReportFiled: '',
  atFaultStatus: '', description: '', trustedFormCertUrl: '', xxTrustedFormToken: '', consentAgreed: false, website: '',
};

export default function ClaimIntakeForm({ initialZip = '' }: { initialZip?: string }) {
  const [fields, setFields] = useState({ ...emptyFields, zipCode: /^\d{5}$/.test(initialZip) ? initialZip : '' });
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ClaimReceipt | null>(null);
  const [clientIp, setClientIp] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const trustedFormValues = useRef({ certUrl: '', pingUrl: '' });

  useEffect(() => {
    const previousCallback = window.trustedFormCertUrlCallback;
    window.trustedFormCertUrlCallback = (certUrl, pingUrl = '') => {
      trustedFormValues.current = { certUrl: certUrl.trim(), pingUrl: pingUrl.trim() };
      const form = formRef.current;
      const certInput = form?.querySelector<HTMLInputElement>('input[name="xxTrustedFormCertUrl"]');
      const pingInput = form?.querySelector<HTMLInputElement>('input[name="xxTrustedFormPingUrl"]');
      if (certInput) certInput.value = certUrl.trim();
      if (pingInput) pingInput.value = pingUrl.trim();
      previousCallback?.(certUrl, pingUrl);
    };

    let script = document.querySelector<HTMLScriptElement>(TRUSTEDFORM_SCRIPT_SELECTOR);
    if (!script) {
      script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = `${TRUSTEDFORM_SCRIPT_URL}&l=${Date.now()}${Math.random()}`;
      script.addEventListener('error', () => {
        console.warn('[TrustedForm] Script failed to load; claim submission will continue without certificate data.');
      }, { once: true });
      document.head.appendChild(script);
    } else if (script) {
      script.addEventListener('error', () => {
        console.warn('[TrustedForm] Script failed to load; claim submission will continue without certificate data.');
      }, { once: true });
    }

    const certInput = formRef.current?.querySelector<HTMLInputElement>('input[name="xxTrustedFormCertUrl"]');
    const pingInput = formRef.current?.querySelector<HTMLInputElement>('input[name="xxTrustedFormPingUrl"]');
    if (certInput?.value) trustedFormValues.current.certUrl = certInput.value.trim();
    if (pingInput?.value) trustedFormValues.current.pingUrl = pingInput.value.trim();

    void fetchClientIp().then(setClientIp);
    return () => {
      if (window.trustedFormCertUrlCallback && window.trustedFormCertUrlCallback !== previousCallback) {
        window.trustedFormCertUrlCallback = previousCallback;
      }
    };
  }, []);

  function update<K extends keyof ClaimFields>(key: K, value: ClaimFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setError('');
  }

  function nextStep() {
    const section = formRef.current?.querySelector(`[data-step="${step}"]`);
    const invalid = section?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(':invalid');
    if (invalid) {
      invalid.focus();
      invalid.reportValidity();
      return;
    }
    setStep((current) => Math.min(current + 1, 3));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!fields.consentAgreed) {
      setError('Please review and accept the privacy and contact consent to continue.');
      return;
    }
    setBusy(true);
    try {
      const form = event.currentTarget;
      const [trustedFormCertUrl, fetchedClientIp] = await Promise.all([
        (async () => {
          const deadline = Date.now() + 4000;
          let certUrl = '';
          while (Date.now() < deadline) {
            certUrl = form.querySelector<HTMLInputElement>('input[name="xxTrustedFormCertUrl"]')?.value.trim()
              || trustedFormValues.current.certUrl;
            if (certUrl) break;
            await new Promise((resolve) => window.setTimeout(resolve, 200));
          }
          if (!certUrl) {
            console.warn('[TrustedForm] No certificate URL was available after 4 seconds. Check that the script is reachable and not blocked by an ad blocker.');
          }
          return certUrl;
        })(),
        waitForClientIp(5500),
      ]);
      const trustedFormPingUrl = form.querySelector<HTMLInputElement>('input[name="xxTrustedFormPingUrl"]')?.value.trim()
        || trustedFormValues.current.pingUrl;
      const xxTrustedFormToken = form.querySelector<HTMLInputElement>('input[name="xxTrustedFormToken"]')?.value.trim()
        || window.trustedForm?.id
        || '';
      let trustedFormCertId = '';
      if (trustedFormCertUrl) {
        try {
          const certificateUrl = new URL(trustedFormCertUrl);
          if (certificateUrl.protocol === 'https:' && ['cert.trustedform.com', 'trustedform.com'].includes(certificateUrl.hostname)) {
            trustedFormCertId = certificateUrl.pathname.split('/').filter(Boolean).at(-1) || '';
          }
        } catch {
          trustedFormCertId = '';
        }
      }
      const headers = await getCsrfHeaders();
      const response = await fetch('/api/claims', {
        method: 'POST', credentials: 'same-origin',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, trustedFormCertUrl, trustedFormPingUrl, trustedFormCertId, xxTrustedFormToken, clientIp: clientIp || fetchedClientIp }),
      });
      const body = await readApiResponse(response, 'We could not submit your claim. Please try again.');
      if (typeof body.claimId !== 'string' || typeof body.pdfUrl !== 'string' || typeof body.status !== 'string') {
        throw new Error('Your intake could not be confirmed. Please contact our team for help.');
      }
      setReceipt({ claimId: body.claimId, pdfUrl: body.pdfUrl, status: body.status } satisfies ClaimReceipt);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not submit your claim. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return <ClaimConfirmation claimId={receipt.claimId} pdfUrl={receipt.pdfUrl} />;
  }

  return <form ref={formRef} className="cjir-card cjir-form cjir-claim-form" onSubmit={submit}>
    <input type="hidden" name="xxTrustedFormCertUrl" defaultValue="" />
    <input type="hidden" name="xxTrustedFormPingUrl" defaultValue="" />
    <input type="hidden" name="xxTrustedFormToken" defaultValue="" />
    <ol className="cjir-form-steps" aria-label="Claim intake progress">{['Your details', 'Accident', 'Review'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>

    {step === 1 && <section data-step="1" className="cjir-section">
      <h2>How can we reach you?</h2>
      <div className="cjir-grid">
        <label className="cjir-field"><span>First name *</span><input autoComplete="given-name" maxLength={100} value={fields.firstName} onChange={(event) => update('firstName', event.target.value)} required /></label>
        <label className="cjir-field"><span>Last name *</span><input autoComplete="family-name" maxLength={100} value={fields.lastName} onChange={(event) => update('lastName', event.target.value)} required /></label>
        <label className="cjir-field"><span>Email *</span><input type="email" autoComplete="email" maxLength={190} value={fields.email} onChange={(event) => update('email', event.target.value)} required /></label>
        <label className="cjir-field"><span>Phone *</span><input type="tel" autoComplete="tel" maxLength={40} value={fields.phone} onChange={(event) => update('phone', event.target.value)} required /></label>
        <label className="cjir-field"><span>ZIP code *</span><input inputMode="numeric" autoComplete="postal-code" maxLength={5} pattern="[0-9]{5}" value={fields.zipCode} onChange={(event) => update('zipCode', event.target.value)} required /></label>
        <label className="cjir-field"><span>City *</span><input autoComplete="address-level2" maxLength={120} value={fields.city} onChange={(event) => update('city', event.target.value)} required /></label>
        <label className="cjir-field"><span>State *</span><select autoComplete="address-level1" value={fields.state} onChange={(event) => update('state', event.target.value)} required><option value="">Select state</option>{STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      </div>
    </section>}

    {step === 2 && <section data-step="2" className="cjir-section">
      <h2>Tell us about the accident</h2>
      <div className="cjir-grid">
        <label className="cjir-field"><span>Accident date *</span><input type="date" max={new Date().toISOString().slice(0, 10)} value={fields.accidentDate} onChange={(event) => update('accidentDate', event.target.value)} required /></label>
        <label className="cjir-field"><span>Accident type *</span><select value={fields.accidentType} onChange={(event) => update('accidentType', event.target.value)} required><option value="">Select type</option>{ACCIDENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className="cjir-field"><span>Were injuries reported? *</span><select value={fields.injuriesReported} onChange={(event) => update('injuriesReported', event.target.value)} required><option value="">Select</option><option>Yes</option><option>No</option></select></label>
        <label className="cjir-field"><span>Was a police report filed? *</span><select value={fields.policeReportFiled} onChange={(event) => update('policeReportFiled', event.target.value)} required><option value="">Select</option><option>Yes</option><option>No</option><option>Unsure</option></select></label>
        <label className="cjir-field"><span>Fault status *</span><select value={fields.atFaultStatus} onChange={(event) => update('atFaultStatus', event.target.value)} required><option value="">Select</option><option>Other Driver</option><option>Shared</option><option>Unsure</option></select></label>
        <label className="cjir-field cjir-contact-message"><span>Brief description *</span><textarea rows={5} maxLength={5000} value={fields.description} onChange={(event) => update('description', event.target.value)} required minLength={10} /></label>
      </div>
    </section>}

    {step === 3 && <section data-step="3" className="cjir-section">
      <h2>Review and consent</h2>
      <dl className="cjir-claim-review"><div><dt>Name</dt><dd>{fields.firstName} {fields.lastName}</dd></div><div><dt>Contact</dt><dd>{fields.email} · {fields.phone}</dd></div><div><dt>Location</dt><dd>{fields.city}, {fields.state} {fields.zipCode}</dd></div><div><dt>Accident</dt><dd>{fields.accidentType} · {fields.accidentDate}</dd></div></dl>
      <div className="cjir-consent" data-tf-element-role="consent-opt-in"><label data-tf-element-role="consent-opt-in"><input type="checkbox" data-tf-element-role="consent-opt-in" checked={fields.consentAgreed} onChange={(event) => update('consentAgreed', event.target.checked)} /><span>By checking this box and submitting, I electronically sign and expressly consent to receive calls and text messages, including using automated technology or prerecorded/artificial voice where permitted, from The Collision Justice and its service providers at the number I provided about my motor vehicle accident claim-support request. Consent is not a condition of purchase. Message and data rates may apply; message frequency varies. I may revoke consent at any time by replying STOP to a text or contacting the company. I understand this consent may apply even if my number is on a federal or state Do Not Call list. I have read the <a href="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</a>. *</span></label></div>
      <p className="cjir-disclosure">{`The Collision Justice is a legal marketing service, not a law firm. ${'Submitting this form does not create an attorney-client relationship.'}`}</p>
      <div className="cjir-honeypot" aria-hidden="true"><label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" value={fields.website} onChange={(event) => update('website', event.target.value)} /></label></div>
    </section>}

    {error && <p className="cjir-form-message" role="alert">{error}</p>}
    <div className="cjir-form-navigation">
      {step > 1 && <button className="cjir-admin-button" type="button" onClick={() => setStep(step - 1)}>Back</button>}
      {step < 3 ? <button className="cjir-submit" type="button" onClick={nextStep}>Continue</button> : <button className="cjir-submit" type="submit" data-tf-element-role="submit" disabled={busy}>{busy ? 'Submitting...' : 'Submit claim intake'}</button>}
    </div>
  </form>;
}