'use client';

import Image from 'next/image';
import { FormEvent, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { getCsrfHeaders } from '@/components/ui/csrf';
import { readApiResponse } from '@/components/ui/api-response';

export default function AdminLoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [challenge, setChallenge] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const reduceMotion = useReducedMotion();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const headers = await getCsrfHeaders();
      const twoFactorMode = Boolean(challenge);
      const response = await fetch(twoFactorMode ? '/api/admin/2fa/verify' : '/api/admin/login', {
        method: 'POST', credentials: 'same-origin',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(twoFactorMode
          ? { challenge, code: form.get('code') }
          : { email: form.get('email'), password: form.get('password'), rememberMe: form.get('rememberMe') === 'on' }),
      });
      const body = await readApiResponse(response, 'Unable to sign in. Please try again.');
      if (body.requiresTwoFactor === true && typeof body.challenge === 'string') {
        setRememberMe(form.get('rememberMe') === 'on');
        setChallenge(body.challenge);
        return;
      }
      if (body.admin) {
        window.location.assign('/admin');
        return;
      }
      throw new Error('Unable to complete sign-in. Please try again.');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="cj-admin-login-screen">
    <motion.section className="cj-admin-login-card" initial={reduceMotion ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.45 }}>
      <div className="cj-admin-login-brand"><Image src="/brand-logo.png" alt="The Collision Justice" width={170} height={58} quality={75} loading="lazy" sizes="170px" /><span><ShieldCheck size={16} /> Protected staff portal</span></div>
      <header><span className="cj-admin-eyebrow">CLAIM OPERATIONS</span><h1>Welcome back.</h1><p>Sign in to review and support claim files.</p></header>
      <form className="cj-admin-login-form" onSubmit={submit}>
        {!challenge ? <>
          <label><span>Email address</span><input name="email" type="email" autoComplete="username" maxLength={190} required /></label>
          <label><span>Password</span><input name="password" type="password" autoComplete="current-password" maxLength={72} required /></label>
          <label className="cj-admin-remember"><input name="rememberMe" type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Remember my login on this device (30 days)</span></label>
        </> : <>
          <p className="cj-admin-2fa-prompt">Enter the 6-digit code from your authenticator app.</p>
          <label><span>Authenticator code</span><input name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} required /></label>
        </>}
        {error && <p className="cj-admin-error" role="alert">{error}</p>}
        <motion.button type="submit" disabled={busy} whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>{busy ? 'Verifying...' : challenge ? <>Verify and sign in <ArrowRight size={17} /></> : <>Sign in <ArrowRight size={17} /></>}</motion.button>
        {challenge && <button className="cj-admin-back-to-login" type="button" onClick={() => { setChallenge(''); setError(''); }}>Back to sign in</button>}
      </form>
      <p className="cj-admin-login-foot">Authorized staff only. Activity may be monitored.</p>
    </motion.section>
  </main>;
}