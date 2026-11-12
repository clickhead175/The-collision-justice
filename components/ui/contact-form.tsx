'use client';

import { FormEvent, useState } from 'react';
import { Send } from 'lucide-react';
import { getCsrfHeaders } from '@/components/ui/csrf';
import { readApiResponse } from '@/components/ui/api-response';

export default function ContactForm() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    setMessage('');
    setSending(true);
    try {
      const csrf = await getCsrfHeaders();
      const response = await fetch('/api/contact', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { ...csrf, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await readApiResponse(response, 'We could not send your message. Please try again.');
      form.reset();
      setError(false);
      setMessage('Thanks. Your message has been received.');
    } catch (submitError) {
      setError(true);
      setMessage(submitError instanceof Error ? submitError.message : 'We could not send your message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="cjir-contact-form cjir-form" onSubmit={submit}>
      <h2>Send us a message</h2>
      <div className="cjir-grid">
        <label className="cjir-field"><span>Name *</span><input name="name" autoComplete="name" maxLength={120} required /></label>
        <label className="cjir-field"><span>Email *</span><input name="email" type="email" autoComplete="email" maxLength={190} required /></label>
        <label className="cjir-field"><span>Phone</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
        <label className="cjir-field"><span>Subject *</span><input name="subject" maxLength={140} required /></label>
        <label className="cjir-field cjir-contact-message"><span>Message *</span><textarea name="message" rows={5} maxLength={4000} required /></label>
      </div>
      <div className="cjir-honeypot" aria-hidden="true"><label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <p className="cjir-disclosure">Please do not include sensitive medical, financial, or account details.</p>
      <p className="cjir-form-message" role={error ? 'alert' : 'status'} aria-live="polite">{message}</p>
      <button className="cjir-submit cjir-contact-submit" type="submit" disabled={sending}><span>{sending ? 'Sending...' : 'Send message'}</span><Send size={17} aria-hidden="true" /></button>
    </form>
  );
}