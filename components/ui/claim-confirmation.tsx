'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, CheckCheck, Copy, Download, House } from 'lucide-react';

type ClientInfo = { ip: string; location: string };

export default function ClaimConfirmation({ claimId, pdfUrl }: { claimId: string; pdfUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let active = true;
    fetch('/api/client-info', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null)
      .then((data: ClientInfo | null) => { if (active && data) setClientInfo(data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function copyId() {
    setCopyFailed(false);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(claimId);
      } else {
        const field = document.createElement('textarea');
        field.value = claimId;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        try {
          field.select();
          if (!document.execCommand('copy')) throw new Error('Clipboard access is unavailable.');
        } finally {
          field.remove();
        }
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  return <section className="cjir-confirmation-scene">
    <motion.div className="cjir-confirmation-backdrop" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} />
    <motion.article className="cjir-confirmation-card" initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 190, damping: 22 }}>
      <motion.div className="cjir-confirmation-check" initial={reduceMotion ? false : { scale: 0, rotate: -35 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 14, delay: reduceMotion ? 0 : 0.12 }}><Check size={31} strokeWidth={3} /></motion.div>
      <p className="cjir-confirmation-eyebrow">INTAKE RECEIVED</p>
      <h1>Thank you — we&apos;ve got your claim</h1>
      <p className="cjir-confirmation-subtitle">A claims specialist will reach out shortly. Keep your Claim ID below to track your file.</p>

      <div className="cjir-confirmation-idbox">
        <span>YOUR CLAIM ID</span>
        <strong>{claimId}</strong>
        <motion.button type="button" onClick={copyId} whileTap={reduceMotion ? undefined : { scale: 0.96 }} aria-label={`Copy claim ID ${claimId}`} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>{copied ? <motion.span key="copied" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}><CheckCheck size={16} /> Copied ✓</motion.span> : copyFailed ? <motion.span key="copy-failed" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>Copy unavailable</motion.span> : <motion.span key="copy" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}><Copy size={15} /> Copy ID</motion.span>}</AnimatePresence>
        </motion.button>
      </div>

      <p className="cjir-confirmation-helper">Keep this number — you can use it any time to check your claim status, and we&apos;ll ask for it when we call.</p>
      <div className="cjir-confirmation-actions">
        <a className="cjir-confirmation-action is-primary" href={pdfUrl}><Download size={17} />Download PDF</a>
        <Link className="cjir-confirmation-action is-navy" href={`/check-claim?id=${encodeURIComponent(claimId)}`}>Check my claim<ArrowRight size={17} /></Link>
        <Link className="cjir-confirmation-action is-light" href="/"><House size={16} />Back to home</Link>
      </div>
      <p className="cjir-confirmation-footnote">The PDF carries your Claim ID and everything you submitted — worth saving or printing.</p>
      <p className="cjir-confirmation-location">Request connection: {clientInfo ? `${clientInfo.ip} · ${clientInfo.location}` : 'Checking approximate location…'}</p>
    </motion.article>
  </section>;
}