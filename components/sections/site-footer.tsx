import Image from 'next/image';
import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import { BRAND } from '@/lib/brand';

export default function SiteFooter() {
  return (
    <footer className="cjir-site-footer">
      <div className="cjir-site-container">
        <div className="cjir-footer-grid">
          <div>
            <Link className="cjir-footer-logo" href="/" aria-label={`${BRAND.name} home`}><Image src={BRAND.logo} alt={BRAND.name} width={190} height={60} quality={75} loading="lazy" sizes="190px" /></Link>
            <p>Clear information and practical claim support for people navigating the aftermath of a motor vehicle accident.</p>
            <p className="cjir-disclosure">{BRAND.disclosure}</p>
          </div>
          <div className="cjir-footer-links"><h2>Explore</h2><Link href="/about">About Us</Link><Link href="/faq">FAQs</Link><Link href="/contact">Contact</Link></div>
          <div className="cjir-footer-links"><h2>Get Started</h2><Link href="/get-a-quote">Start a Claim</Link><Link href="/check-claim">Check Claim Status</Link></div>
          <div className="cjir-footer-contact"><h2>Contact</h2><a href={`tel:${BRAND.phoneHref}`}><Phone size={16} aria-hidden="true" />{BRAND.phone}</a><a href={`mailto:${BRAND.email}`}><Mail size={16} aria-hidden="true" />{BRAND.email}</a><span>310 Oakley Avenue<br />Lynchburg, VA 24501</span></div>
        </div>
        <div className="cjir-footer-bottom"><span>© {new Date().getFullYear()} The Collision Justice. All rights reserved.</span><span className="cjir-footer-links"><Link href="/privacy-policy">Privacy Policy</Link><Link href="/terms">Terms</Link></span></div>
      </div>
    </footer>
  );
}