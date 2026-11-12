import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { BookOpenCheck, Files, HeartHandshake, PhoneCall } from 'lucide-react';
import { Reveal } from '@/components/ui/motion';
import { BRAND, SITE_URL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn how The Collision Justice helps drivers understand common next steps after a motor vehicle accident.',
  alternates: { canonical: '/about' },
  openGraph: { title: 'About The Collision Justice', description: 'Practical information and support after a motor vehicle accident.', url: `${SITE_URL}/about` },
};

const values = [
  { Icon: BookOpenCheck, title: 'Clear guidance', description: 'Understand common claim steps with clear, practical information.' },
  { Icon: Files, title: 'Fast document support', description: 'Get help identifying and organizing the details and documents you may need.' },
  { Icon: HeartHandshake, title: 'Respectful, transparent process', description: 'Get thoughtful answers and clear expectations at every step.' },
];

export default function AboutPage() {
  return <main className="cjir-content-page cjir-about-page">
    <Reveal as="section" className="cjir-page-banner"><div className="cjir-site-container"><span className="cjir-section-kicker">ABOUT THE COLLISION JUSTICE</span><h1>Helping you find your next step after an accident</h1><p>When a collision disrupts your day, clear information can make the road ahead feel more manageable.</p></div></Reveal>
    <Reveal as="section" className="cjir-site-container cjir-about-intro"><div className="cjir-about-image"><Image src="/about-reviewing-claim.png" alt="Driver reviewing claim information after a collision" fill quality={75} loading="lazy" sizes="(max-width: 700px) 100vw, 50vw" /></div><div><span className="cjir-section-kicker">WHO WE ARE</span><h2>Guidance when you need it most</h2><p>The Collision Justice is a legal marketing service that provides information and support for people navigating motor vehicle accident questions.</p><p>We are not a law firm and do not provide legal advice. Our goal is to help you understand common processes, organize important details, and decide what questions to ask next.</p><Link className="cjir-primary-link" href="/contact">Talk with our team <span aria-hidden="true">→</span></Link></div></Reveal>
    <Reveal as="section" className="cjir-about-purpose"><div className="cjir-site-container"><header className="cjir-section-heading"><span className="cjir-section-kicker">OUR CORE VALUES</span><h2>Support built around clarity</h2><p>Every accident is different. We focus on helpful information and respectful communication.</p></header><div className="cjir-purpose-grid">{values.map(({ Icon, title, description }) => <article key={title}><span className="cjir-purpose-icon" aria-hidden="true"><Icon size={20} /></span><h3>{title}</h3><p>{description}</p></article>)}</div></div></Reveal>
    <div className="cjir-about-cta-wrap"><Reveal as="section" className="cjir-site-container cjir-about-cta"><div className="cjir-about-cta-card"><span className="cjir-section-kicker">WE&apos;RE HERE TO HELP</span><h2>Ready to get clarity on your claim?</h2><p>Start with a few details and our team can help you understand the next steps.</p><div className="cjir-about-cta-actions"><Link className="cjir-primary-link" href="/get-a-quote">Start Your Free Claim Check <span aria-hidden="true">→</span></Link><a className="cjir-cta-phone" href={`tel:${BRAND.phoneHref}`}><PhoneCall size={18} aria-hidden="true" />Call {BRAND.phone}</a></div></div></Reveal></div>
  </main>;
}