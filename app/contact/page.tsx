import type { Metadata } from 'next';
import { Mail, MapPin, PhoneCall } from 'lucide-react';
import Link from 'next/link';
import ContactForm from '@/components/ui/contact-form';
import { Reveal } from '@/components/ui/motion';
import { BRAND, SITE_URL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Contact The Collision Justice in Lynchburg, Virginia, by phone, email, or secure inquiry form.',
  alternates: { canonical: '/contact' },
  openGraph: { title: 'Contact The Collision Justice', description: 'Reach our team for information about accident claim support.', url: `${SITE_URL}/contact` },
};

export default function ContactPage() {
  return <main className="cjir-content-page">
    <Reveal as="section" className="cjir-page-banner"><div className="cjir-site-container"><span className="cjir-section-kicker">WE&apos;RE HERE TO HELP</span><h1>Contact The Collision Justice</h1><p>Reach our team with a question or request. Please do not include highly sensitive medical or financial information.</p></div></Reveal>
    <Reveal as="section" className="cjir-site-container cjir-contact-content">
      <div className="cjir-contact-layout">
        <article className="cjir-contact-details">
          <header><span className="cjir-section-kicker">GET IN TOUCH</span><h2>We&apos;re here to help</h2><p>Reach out using the option that works best for you.</p></header>
          <div className="cjir-contact-detail"><span className="cjir-contact-icon" aria-hidden="true"><Mail size={20} /></span><div><h3>Email Us</h3><a href={`mailto:${BRAND.email}`}>{BRAND.email}</a></div></div>
          <div className="cjir-contact-detail"><span className="cjir-contact-icon" aria-hidden="true"><PhoneCall size={20} /></span><div><h3>Call Us</h3><a href={`tel:${BRAND.phoneHref}`}>{BRAND.phone}</a></div></div>
          <div className="cjir-contact-detail"><span className="cjir-contact-icon" aria-hidden="true"><MapPin size={20} /></span><div><h3>Office</h3><p>310 Oakley Avenue<br />Lynchburg, VA 24501</p><a href="https://maps.google.com/?q=310+Oakley+Avenue+Lynchburg+VA+24501">Get directions <span aria-hidden="true">→</span></a></div></div>
        </article>
        <ContactForm />
      </div>
      <div className="cjir-inline-cta"><p>Ready to share claim details?</p><Link className="cjir-primary-link" href="/get-a-quote">Start an intake <span aria-hidden="true">→</span></Link></div>
    </Reveal>
  </main>;
}