'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { useState } from 'react';
import { BRAND } from '@/lib/brand';

const links = [
  ['Home', '/'], ['About', '/about'], ['FAQ', '/faq'], ['Contact', '/contact'],
  ['Get a Quote', '/get-a-quote'], ['Check Claim', '/check-claim'],
] as const;

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="cjir-site-header" onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
      <div className="cjir-topbar">
        <div className="cjir-site-container cjir-topbar-inner">
          <a href="https://maps.google.com/?q=310+Oakley+Avenue+Lynchburg+VA+24501"><MapPin size={14} aria-hidden="true" />310 Oakley Avenue, Lynchburg, VA 24501</a>
          <div><a href={`mailto:${BRAND.email}`}><Mail size={14} aria-hidden="true" />{BRAND.email}</a><a href={`tel:${BRAND.phoneHref}`}><Phone size={14} aria-hidden="true" />{BRAND.phone}</a></div>
        </div>
      </div>
      <div className="cjir-main-header">
        <div className="cjir-site-container cjir-main-header-inner">
          <Link className="cjir-main-logo" href="/" aria-label={`${BRAND.name} home`} onClick={() => setOpen(false)}>
            <Image src={BRAND.logo} alt={BRAND.name} width={210} height={68} quality={75} loading="eager" sizes="210px" />
          </Link>
          <button className="cjir-menu-toggle" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>
            <span /><span /><span />
          </button>
          <nav id="main-navigation" className={`cjir-main-nav${open ? ' is-open' : ''}`} aria-label="Main navigation">
            {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
          </nav>
        </div>
      </div>
    </header>
  );
}