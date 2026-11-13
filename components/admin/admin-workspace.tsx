'use client';

import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Activity, ArrowDownToLine, ArrowUpRight, BadgeCheck, Check, ChevronLeft,
  ChevronRight, Clipboard, FileText, Home, LogOut, Menu, Search, X,
  Settings,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ACCIDENT_TYPES, CLAIM_STATUSES, STATES } from '@/lib/brand';
import { AnimatedNumber } from '@/components/ui/motion';
import { getCsrfHeaders } from '@/components/ui/csrf';
import { formatClaimantLocation, hasVerifiedReferenceIp } from '@/lib/claim-location';

type Claim = {
  _id: string;
  claimId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  zipCode: string;
  city: string;
  state: string;
  claimantCity?: string;
  claimantState?: string;
  locationSource?: string;
  accidentDate: string;
  accidentType: string;
  injuriesReported: string;
  policeReportFiled: string;
  atFaultStatus: string;
  description: string;
  consentTimestamp: string;
  ipAddress?: string;
  geoLocation?: string;
  geoLocationSource?: string;
  referenceIp?: string;
  referenceIpGeoLocation?: string;
  referenceIpProvider?: string;
  referenceIpOrganization?: string;
  referenceIpAsn?: number;
  referenceIpSource?: string;
  trustedFormCertUrl?: string;
  trustedFormCertId?: string;
  trustedFormPingUrl?: string;
  status: string;
  internalNotes: string;
  createdAt: string;
};
type Inquiry = { _id: string; name: string; email: string; phone: string; subject: string; message: string; createdAt: string };
type Summary = { totalClaims: number; newIntakes: number; pendingDocs: number; filed: number };
type Role = 'superadmin' | 'admin' | 'viewer';

async function readJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'The request could not be completed.');
  return body;
}

function statusClass(status: string) {
  return status.toLowerCase().replaceAll(' ', '-');
}

function getTrustedFormLeadId(url: string) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' || !['cert.trustedform.com', 'trustedform.com'].includes(parsedUrl.hostname)) return '';
    return parsedUrl.pathname.split('/').filter(Boolean).at(-1) || '';
  } catch {
    return '';
  }
}

export default function AdminWorkspace({ devPreview = false }: { devPreview?: boolean }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [editingInquiry, setEditingInquiry] = useState<Inquiry | null>(null);
  const [creatingInquiry, setCreatingInquiry] = useState(false);
  const [summary, setSummary] = useState<Summary>({ totalClaims: 0, newIntakes: 0, pendingDocs: 0, filed: 0 });
  const [selected, setSelected] = useState<Claim | null>(null);
  const [tab, setTab] = useState<'claims' | 'inquiries'>('claims');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [state, setState] = useState('');
  const [accidentType, setAccidentType] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    fetch('/api/admin/me', { cache: 'no-store' }).then(readJson).then((data) => {
      setEmail(data.admin.email);
      setRole(data.admin.role);
    }).catch(() => window.location.replace('/admin/login'));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({ page: String(page), search, status, state, accidentType });
    fetch(`/api/admin/claims/search?${query}`, { cache: 'no-store' })
      .then(readJson)
      .then((data) => {
        if (!active) return;
        setClaims(data.claims);
        setSummary({ totalClaims: data.totalClaims, newIntakes: data.newIntakes, pendingDocs: data.pendingDocs, filed: data.filed });
        setLastPage(data.lastPage);
        setMessage('');
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'Could not load claims.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, search, status, state, accidentType]);

  const visibleClaims = useMemo(() => claims, [claims]);

  async function loadInquiries() {
    setLoading(true);
    try {
      const data = await readJson(await fetch('/api/admin/contacts', { cache: 'no-store' }));
      setInquiries(data.inquiries);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load inquiries.');
    } finally {
      setLoading(false);
    }
  }

  async function updateClaim(claim: Claim, updates: { status?: string; internalNotes?: string }) {
    setMessage('');
    try {
      const csrf = await getCsrfHeaders();
      await readJson(await fetch(`/api/admin/claims/${claim.claimId}`, {
        method: 'PATCH', credentials: 'same-origin', headers: { ...csrf, 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
      }));
      setSelected((current) => current?.claimId === claim.claimId ? { ...current, ...updates } : current);
      setClaims((current) => current.map((item) => item.claimId === claim.claimId ? { ...item, ...updates } : item));
      setMessage('Claim updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update claim.');
    }
  }

  async function deleteClaim(claim: Claim) {
    if (!window.confirm(`Permanently delete claim ${claim.claimId}?`)) return;
    try {
      const csrf = await getCsrfHeaders();
      await readJson(await fetch(`/api/admin/claims/${claim.claimId}`, {
        method: 'DELETE', credentials: 'same-origin', headers: csrf,
      }));
      setClaims((current) => current.filter((item) => item.claimId !== claim.claimId));
      setSelected(null);
      setMessage('Claim deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete claim.');
    }
  }

  async function deleteInquiry(inquiry: Inquiry) {
    if (!window.confirm(`Permanently delete the inquiry from ${inquiry.name}?`)) return;
    try {
      const csrf = await getCsrfHeaders();
      await readJson(await fetch(`/api/admin/contacts/${inquiry._id}`, {
        method: 'DELETE', credentials: 'same-origin', headers: csrf,
      }));
      setInquiries((current) => current.filter((item) => item._id !== inquiry._id));
      setMessage('Contact inquiry deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete inquiry.');
    }
  }

  async function saveInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      name: form.get('name'), email: form.get('email'), phone: form.get('phone'),
      subject: form.get('subject'), message: form.get('message'),
    };
    try {
      const csrf = await getCsrfHeaders();
      const target = editingInquiry;
      const response = await fetch(target ? `/api/admin/contacts/${target._id}` : '/api/admin/contacts', {
        method: target ? 'PATCH' : 'POST',
        credentials: 'same-origin',
        headers: { ...csrf, 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      await readJson(response);
      setEditingInquiry(null);
      setCreatingInquiry(false);
      await loadInquiries();
      setMessage(target ? 'Contact inquiry updated.' : 'Contact inquiry created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save contact inquiry.');
    }
  }

  async function logout() {
    try {
      const csrf = await getCsrfHeaders();
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin', headers: csrf });
    } finally {
      window.location.assign('/admin/login');
    }
  }

  async function copyClaimId() {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.claimId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const stats = [
    { label: 'Total claims', value: summary.totalClaims, icon: <FileText /> },
    { label: 'New intakes', value: summary.newIntakes, icon: <Activity /> },
    { label: 'Reviewing docs', value: summary.pendingDocs, icon: <Clipboard /> },
    { label: 'Filed claims', value: summary.filed, icon: <BadgeCheck /> },
  ];

  return <main className="cj-admin-app">
    <button className="cj-admin-mobile-menu" type="button" aria-label="Open admin menu" onClick={() => setSidebarOpen(true)}><Menu /></button>
    <AnimatePresence>{sidebarOpen && <motion.button className="cj-admin-backdrop" aria-label="Close admin menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />}</AnimatePresence>
    <aside className={`cj-admin-sidebar${sidebarOpen ? ' is-open' : ''}`}>
      <div className="cj-admin-sidebar-brand"><Image src="/brand-logo.png" alt="The Collision Justice" width={155} height={50} quality={75} loading="lazy" sizes="155px" /><span className="cj-admin-live-indicator"><i /> Secure workspace</span></div>
      <nav className="cj-admin-sidebar-nav" aria-label="Admin navigation">
        <a className="is-active" href="#overview" onClick={() => setSidebarOpen(false)}><Home size={17} />Dashboard overview</a>
        <a href="#claims" onClick={() => { setTab('claims'); setSidebarOpen(false); }}><FileText size={17} />All claims</a>
        <a href="#inquiries" onClick={() => { setTab('inquiries'); void loadInquiries(); setSidebarOpen(false); }}><Clipboard size={17} />Contact inquiries</a>
        <a href="/api/admin/claims/export"><ArrowDownToLine size={17} />Export CSV</a>
        <a href="/admin/settings" onClick={() => setSidebarOpen(false)}><Settings size={17} />Settings &amp; security</a>
        <a href="/" target="_blank" rel="noreferrer"><ArrowUpRight size={17} />View live site</a>
      </nav>
      <div className="cj-admin-sidebar-bottom"><span>{email || 'Admin account'}</span><button type="button" onClick={logout}><LogOut size={17} />Log out</button></div>
    </aside>

    <div className="cj-admin-main">
      <header className="cj-admin-topbar"><div><span className="cj-admin-eyebrow">CLAIM OPERATIONS</span><h1>Dashboard overview</h1>{devPreview && <span className="cj-admin-preview-badge">LOCAL DEVELOPMENT DEMO · changes are in memory only</span>}</div><div className="cj-admin-topbar-meta"><span className="cj-admin-live-indicator"><i />All systems current</span><span>{email}</span><span className={`cj-admin-role-badge role-${role}`}>{role === 'superadmin' ? 'SUPER ADMIN' : role.toUpperCase()}</span></div></header>
      {message && <motion.p className="cj-admin-toast" role="status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>{message}</motion.p>}

      <section id="overview" className="cj-admin-kpis" aria-label="Claim summary">
        {stats.map((stat, index) => <motion.article className="cj-admin-kpi" key={stat.label} initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : index * 0.08, duration: 0.45 }}><span className="cj-admin-kpi-icon">{stat.icon}</span><span className="cj-admin-kpi-label">{stat.label}</span><strong>{loading ? '—' : <AnimatedNumber value={stat.value} />}</strong><small>All claims</small></motion.article>)}
      </section>

      <section id="claims" className="cj-admin-panel">
        <div className="cj-admin-panel-heading"><div><span className="cj-admin-eyebrow">CLAIMS COMMAND</span><h2>Claims workspace</h2></div><div className="cj-admin-panel-actions">{role !== 'viewer' && <a className="cj-admin-create-link" href="/get-a-quote">Create lead</a>}<span className="cj-admin-count">{loading ? 'Updating…' : `${visibleClaims.length} shown`}</span></div></div>
        <div className="cj-admin-tabs" role="tablist" aria-label="Admin sections"><button role="tab" aria-selected={tab === 'claims'} className={tab === 'claims' ? 'is-active' : ''} onClick={() => setTab('claims')}>All claims</button><button id="inquiries" role="tab" aria-selected={tab === 'inquiries'} className={tab === 'inquiries' ? 'is-active' : ''} onClick={() => { setTab('inquiries'); void loadInquiries(); }}>Contact inquiries</button></div>
        {tab === 'claims' ? <>
          <label className="cj-admin-search"><Search size={18} /><input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search Claim ID, name, phone, or ZIP" aria-label="Search loaded claims by Claim ID, name, phone, or ZIP" /></label>
          <div className="cj-admin-filter-pills" role="group" aria-label="Filter by claim status">{['', ...CLAIM_STATUSES].map((item) => <button key={item || 'All'} className={status === item ? 'is-active' : ''} onClick={() => { setPage(1); setStatus(item); }}>{item || 'All'}</button>)}</div>
          <div className="cj-admin-secondary-filters"><label><span>State</span><select value={state} onChange={(event) => { setPage(1); setState(event.target.value); }}><option value="">All states</option>{STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label><label><span>Accident type</span><select value={accidentType} onChange={(event) => { setPage(1); setAccidentType(event.target.value); }}><option value="">All types</option>{ACCIDENT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label></div>
          <div className="cj-admin-table-wrap"><table className="cj-admin-table"><thead><tr><th>Claim ID</th><th>Driver</th><th>Location</th><th>Accident</th><th>Submitted</th><th>Status</th></tr></thead><tbody>
            {visibleClaims.map((claim) => <tr key={claim._id} tabIndex={0} onClick={() => { setSelected(claim); setCopied(false); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelected(claim); }}><td><strong className="cj-admin-claim-id">{claim.claimId}</strong></td><td>{claim.firstName} {claim.lastName}<small>{claim.phone}</small></td><td>{formatClaimantLocation(claim)}<small>Claimant-selected location</small></td><td>{claim.accidentType}<small>{new Date(claim.accidentDate).toLocaleDateString()}</small></td><td>{new Date(claim.createdAt).toLocaleDateString()}</td><td><span className={`cj-admin-status status-${statusClass(claim.status)}`}>{claim.status}</span></td></tr>)}
            {!loading && visibleClaims.length === 0 && <tr><td className="cj-admin-empty" colSpan={6}>No claims match these filters.</td></tr>}
          </tbody></table></div>
          <div className="cj-admin-pagination"><button disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}><ChevronLeft size={16} />Previous</button><span>Page {page} of {lastPage}</span><button disabled={page >= lastPage || loading} onClick={() => setPage(page + 1)}>Next<ChevronRight size={16} /></button></div>
        </> : <>
          {role !== 'viewer' && <div className="cj-admin-contact-actions"><button type="button" onClick={() => { setEditingInquiry(null); setCreatingInquiry(true); }}>Create inquiry</button></div>}
          {(creatingInquiry || editingInquiry) && <form className="cj-admin-inquiry-editor" onSubmit={saveInquiry} key={editingInquiry?._id || (creatingInquiry ? 'new' : 'closed')}>
            <h3>{editingInquiry ? 'Edit contact inquiry' : 'Create contact inquiry'}</h3>
            <div className="cj-admin-inquiry-fields">
              <label><span>Name</span><input name="name" maxLength={120} defaultValue={editingInquiry?.name || ''} required /></label>
              <label><span>Email</span><input name="email" type="email" maxLength={190} defaultValue={editingInquiry?.email || ''} required /></label>
              <label><span>Phone</span><input name="phone" type="tel" maxLength={40} defaultValue={editingInquiry?.phone || ''} /></label>
              <label><span>Subject</span><input name="subject" maxLength={140} defaultValue={editingInquiry?.subject || ''} required /></label>
              <label className="cj-admin-inquiry-message"><span>Message</span><textarea name="message" minLength={10} maxLength={4000} defaultValue={editingInquiry?.message || ''} required /></label>
            </div>
            <div className="cj-admin-contact-actions"><button type="submit">{editingInquiry ? 'Save changes' : 'Create inquiry'}</button><button type="button" className="is-secondary" onClick={() => { setCreatingInquiry(false); setEditingInquiry(null); }}>Cancel</button></div>
          </form>}
          <div className="cj-admin-table-wrap"><table className="cj-admin-table"><thead><tr><th>Name</th><th>Subject</th><th>Email</th><th>Phone</th><th>Received</th><th>Message</th>{role !== 'viewer' && <th>Actions</th>}</tr></thead><tbody>{inquiries.map((item) => <tr key={item._id}><td>{item.name}</td><td>{item.subject}</td><td><a href={`mailto:${item.email}`}>{item.email}</a></td><td>{item.phone || '—'}</td><td>{new Date(item.createdAt).toLocaleDateString()}</td><td>{item.message}</td>{role !== 'viewer' && <td><div className="cj-admin-contact-row-actions"><button type="button" onClick={() => { setCreatingInquiry(false); setEditingInquiry(item); }}>Edit</button><button className="cj-admin-row-delete" type="button" onClick={() => void deleteInquiry(item)}>Delete</button></div></td>}</tr>)}{!loading && inquiries.length === 0 && <tr><td className="cj-admin-empty" colSpan={role === 'viewer' ? 6 : 7}>No contact inquiries.</td></tr>}</tbody></table></div>
        </>}
      </section>
    </div>

    <AnimatePresence>{selected && <>
      <motion.button className="cj-admin-drawer-scrim" aria-label="Close claim details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} />
      <motion.aside className="cj-admin-drawer" role="dialog" aria-modal="true" aria-labelledby="claim-drawer-title" initial={reduceMotion ? false : { x: '100%' }} animate={{ x: 0 }} exit={reduceMotion ? undefined : { x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 280 }}>
        <header className="cj-admin-drawer-header"><div><span className="cj-admin-eyebrow">CLAIM DETAILS</span><h2 id="claim-drawer-title">{selected.claimId}</h2></div><button aria-label="Close details" onClick={() => setSelected(null)}><X /></button></header>
        <div className="cj-admin-drawer-body"><div className="cj-admin-drawer-id"><span>CLAIM ID</span><strong>{selected.claimId}</strong><button onClick={() => void copyClaimId()}>{copied ? <><Check size={15} />Copied</> : <><Clipboard size={15} />Copy ID</>}</button></div>
          <a className="cj-admin-pdf-button" href={`/api/claims/${selected.claimId}/pdf`}><ArrowDownToLine size={17} />Download Claim PDF</a>
          <section className="cj-admin-detail-section"><h3>Driver details</h3><dl><div><dt>Name</dt><dd>{selected.firstName} {selected.lastName}</dd></div><div><dt>Phone</dt><dd>{selected.phone}</dd></div><div><dt>Email</dt><dd>{selected.email}</dd></div><div><dt>Claimant-selected location</dt><dd>{formatClaimantLocation(selected)}</dd></div><div><dt>Location source</dt><dd>{selected.locationSource === 'claimant_selected' ? 'Claimant selection' : 'Legacy claim fields'}</dd></div></dl></section>
          <section className="cj-admin-detail-section"><h3>Accident summary</h3><dl><div><dt>Date</dt><dd>{new Date(selected.accidentDate).toLocaleDateString()}</dd></div><div><dt>Type</dt><dd>{selected.accidentType}</dd></div><div><dt>Injuries</dt><dd>{selected.injuriesReported}</dd></div><div><dt>Police report</dt><dd>{selected.policeReportFiled}</dd></div><div><dt>Fault status</dt><dd>{selected.atFaultStatus}</dd></div><div><dt>Consent recorded</dt><dd>{new Date(selected.consentTimestamp).toLocaleString()}</dd></div></dl><p className="cj-admin-story">{selected.description}</p></section>
          <section className="cj-admin-detail-section"><h3>Network reference (not claimant identity)</h3><dl><div><dt>Verified reference IP</dt><dd>{hasVerifiedReferenceIp(selected) ? selected.referenceIp : 'Not available'}</dd></div><div><dt>Reference IP location</dt><dd>{hasVerifiedReferenceIp(selected) ? selected.referenceIpGeoLocation || 'Not available' : 'Not available'}</dd></div><div><dt>Original network organization</dt><dd>{hasVerifiedReferenceIp(selected) ? selected.referenceIpOrganization || 'Not available' : 'Not available'}</dd></div><div><dt>Normalized provider</dt><dd>{hasVerifiedReferenceIp(selected) ? selected.referenceIpProvider || 'Other / Unknown' : 'Other / Unknown'}</dd></div><div><dt>ASN</dt><dd>{hasVerifiedReferenceIp(selected) && selected.referenceIpAsn ? `AS${selected.referenceIpAsn}` : 'Not available'}</dd></div><div><dt>Reference source</dt><dd>{hasVerifiedReferenceIp(selected) ? 'Independent network allocation and geolocation verification' : 'Not available'}</dd></div></dl></section>
          <section className="cj-admin-detail-section"><h3>Submission record</h3><dl>{selected.ipAddress && <div><dt>Submitter IP (not claimant IP)</dt><dd>{selected.ipAddress}</dd></div>}{selected.geoLocation && <div><dt>{selected.geoLocationSource === 'geolite2' ? 'Submitter IP location (approx.)' : selected.geoLocationSource === 'vercel' ? 'Submitter IP location (Vercel estimate)' : 'Submitter IP location (source unknown)'}</dt><dd>{selected.geoLocation}</dd></div>}{selected.trustedFormCertUrl && <div><dt>TrustedForm</dt><dd className="cj-admin-break-word"><a href={selected.trustedFormCertUrl} target="_blank" rel="noreferrer">{selected.trustedFormCertUrl}</a></dd></div>}{(selected.trustedFormCertId || getTrustedFormLeadId(selected.trustedFormCertUrl || '')) && <div><dt>Lead ID</dt><dd>{selected.trustedFormCertId || getTrustedFormLeadId(selected.trustedFormCertUrl || '')}</dd></div>}{selected.trustedFormPingUrl && <div><dt>TrustedForm ping URL</dt><dd className="cj-admin-break-word"><a href={selected.trustedFormPingUrl} target="_blank" rel="noreferrer">{selected.trustedFormPingUrl}</a></dd></div>}</dl></section>
          {role !== 'viewer' && <section className="cj-admin-detail-section"><h3>Claim progress</h3><label className="cj-admin-control"><span>Status</span><select value={selected.status} onChange={(event) => void updateClaim(selected, { status: event.target.value })}>{CLAIM_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label><label className="cj-admin-control"><span>Internal notes</span><textarea rows={5} maxLength={10000} defaultValue={selected.internalNotes} id="claim-internal-notes" /></label><button className="cj-admin-save" onClick={() => { const notes = document.getElementById('claim-internal-notes') as HTMLTextAreaElement | null; if (notes) void updateClaim(selected, { internalNotes: notes.value }); }}>Save notes</button></section>}
          {role !== 'viewer' && <button className="cj-admin-row-delete cj-admin-delete-claim" type="button" onClick={() => void deleteClaim(selected)}>Delete claim</button>}
        </div>
      </motion.aside>
    </>}</AnimatePresence>
  </main>;
}