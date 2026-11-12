import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, CalendarDays, Clock3, Headphones, HeartHandshake, MapPin, Phone, ShieldCheck, UsersRound } from 'lucide-react';
import FaqAccordion from '@/components/ui/faq-accordion';
import RedSedanShowcase from '@/components/three/RedSedan3DShowcase';
import { AnimatedNumber, Reveal, StaggerGroup, StaggerItem } from '@/components/ui/motion';
import { BRAND, FAQS, SITE_URL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Motor Vehicle Accident Claim Support',
  description: 'Crashed? Get clear next steps, document guidance, and real human support for your motor vehicle accident claim.',
  alternates: { canonical: '/' },
  openGraph: { title: 'MVA Claim Support | The Collision Justice', description: 'Clear next steps and human support after a motor vehicle accident.', url: SITE_URL },
};

const leftServices = [
  ['01', 'Accident Guidance', 'Understand practical next steps after a collision, from documenting the scene to speaking with insurers.'],
  ['02', 'Document Support', 'Gather useful records such as a police report, photographs, and medical information.'],
];
const rightServices = [
  ['03', 'Hassle-Free Process', 'Keep details and follow-ups organized with a clear, guided process.'],
  ['04', 'Fast Claim Handling', 'A real person can review your request and explain the information you may need next.'],
];

const testimonials = [
  ['DB', 'Danielle B.', 'Phoenix, AZ', 'After my rear-end accident I had no idea where to start. The team walked me through the forms and explained what documents to gather.'],
  ['AC', 'Anthony C.', 'Tampa, FL', 'Straightforward and no pressure. I submitted my information and got a call back the same day.'],
  ['PN', 'Priya N.', 'Columbus, OH', 'I was overwhelmed after the crash, but the process felt manageable once someone explained the next steps.'],
];

const trustStats = [
  { value: 45000, suffix: '+', label: 'Drivers Assisted', icon: UsersRound },
  { value: 98, suffix: '%', label: 'Client Satisfaction', icon: HeartHandshake },
  { value: 24, suffix: '/7', label: 'Support Availability', icon: Headphones },
  { value: 10, suffix: '+', label: 'Years of Experience', icon: CalendarDays },
];

export default function HomePage() {
  return (
    <main className="cjir-homepage">
      <section className="cjir-hero">
        <Image className="cjir-hero-image" src="/home-crashed-car-crimson.webp" alt="Vehicle damaged in a collision" fill preload quality={75} sizes="100vw" />
        <div className="cjir-hero-shade" />
        <div className="cjir-site-container cjir-hero-content"><div className="cjir-hero-copy">
          <span className="cjir-eyebrow">HERE FOR THE ROAD AHEAD</span>
          <h1>Crashed? Don&apos;t stress — we&apos;ve got your claim.</h1>
          <p>After a collision, the next steps can feel like a lot. Get a clear starting point, practical document guidance, and support from a real person.</p>
          <form className="cjir-zip-form" action="/get-a-quote" method="get">
            <label className="cjir-visually-hidden" htmlFor="home-zip">ZIP code</label>
            <input id="home-zip" name="zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} pattern="[0-9]{5}" placeholder="Enter your ZIP code" required />
            <button className="cjir-zip-submit" type="submit">Get Started <ArrowRight size={17} aria-hidden="true" /></button>
          </form>
          <div className="cj-hero-trust"><div className="cj-hero-avatars" aria-label="Driver initials MR DB AC PN"><span>MR</span><span>DB</span><span>AC</span><span>PN</span></div><div><strong>Trusted by 45,000+ drivers</strong><small>People-first support, nationwide</small></div></div>
          <p className="cjir-hero-note">No upfront fees to submit an intake. No obligation.</p>
        </div></div>
      </section>

      <Reveal className="cj-stats-band"><div className="cj-stats-inner">
        {trustStats.map(({ value, suffix, label, icon: Icon }) => <div className="cj-stat" key={label}><Icon className="cj-stat-icon" size={19} strokeWidth={2.25} aria-hidden="true" /><strong><AnimatedNumber value={value} suffix={suffix} /></strong><span>{label}</span></div>)}
      </div></Reveal>

      <Reveal className="cjir-home-story cjir-site-container">
        <div className="cjir-story-image"><Image src="/about-driver.jpg" alt="Driver reviewing accident support information" fill quality={75} loading="lazy" sizes="(max-width: 700px) 100vw, 50vw" /></div>
        <div className="cjir-story-copy"><span className="cjir-section-kicker">WHY THE COLLISION JUSTICE</span><h2>Support when the road changes</h2>
          <p>A motor vehicle accident can leave you juggling calls, appointments, and unfamiliar paperwork. Our team helps you understand common next steps and organize the information you may need.</p>
          <p>The Collision Justice is a legal marketing service, not a law firm. We can help you find information and connect with resources relevant to your request.</p>
          <Link className="cjir-primary-link" href="/about">Learn more about us <span aria-hidden="true">→</span></Link>
        </div>
      </Reveal>

      <section className="cjir-home-services"><div className="cjir-site-container">
        <header className="cjir-section-heading cjir-services-heading"><span className="cjir-section-kicker">WHAT WE DO</span><h2>Comprehensive Claim Support</h2><p>Clear information and practical support to help you take one step at a time.</p><span className="cjir-heading-rule" aria-hidden="true" /></header>
        <StaggerGroup className="cj-support-showcase">
          <div className="cj-support-column">{leftServices.map(([number, title, copy]) => <StaggerItem className="cj-support-card" key={number}><article><span>{number}</span><h3>{title}</h3><p>{copy}</p><Link href="/get-a-quote">Explore support <ArrowRight size={15} /></Link></article></StaggerItem>)}</div>
          <StaggerItem className="cj-sedan-center"><RedSedanShowcase /></StaggerItem>
          <div className="cj-support-column">{rightServices.map(([number, title, copy]) => <StaggerItem className="cj-support-card" key={number}><article><span>{number}</span><h3>{title}</h3><p>{copy}</p><Link href="/get-a-quote">Explore support <ArrowRight size={15} /></Link></article></StaggerItem>)}</div>
        </StaggerGroup>
      </div></section>

      <section className="cjir-home-why cjir-site-container">
        <header className="cjir-section-heading cjir-why-heading"><span className="cjir-section-kicker">WHY DRIVERS CHOOSE US</span><h2>A calmer place to start</h2><span className="cjir-heading-rule" aria-hidden="true" /></header>
        <StaggerGroup className="cjir-benefit-grid">{[
          ['No upfront fee to start', 'Submit an intake and speak with our team without an upfront service fee.'],
          ['Real human support', 'Talk through your questions with a person who can explain the process.'],
          ['Practical next steps', 'Know what information to collect and which questions to ask.'],
          ['Respect for your choices', 'You decide how to proceed after reviewing the information provided.'],
        ].map(([title, copy], index) => <StaggerItem key={title} className="cjir-benefit-card"><article><div className="cjir-card-content"><span className="cjir-benefit-icon">{index === 0 ? <ShieldCheck /> : index === 1 ? <BadgeCheck /> : <ArrowRight />}</span><h3>{title}</h3><p>{copy}</p></div></article></StaggerItem>)}</StaggerGroup>
      </section>

      <section className="cjir-home-testimonials"><div className="cjir-site-container">
        <header className="cjir-section-heading cjir-testimonials-heading"><span className="cjir-section-kicker">DRIVER EXPERIENCES</span><h2>What drivers say</h2><p>Examples of the kind of clear, respectful support people look for after a crash.</p></header>
        <div className="cjir-testimonial-rating"><strong><AnimatedNumber value={4.8} decimals={1} /></strong><span className="cjir-rating-copy"><span className="cjir-rating-stars" aria-label="Rated 4.8 out of 5">★★★★★</span><span>out of 5 · <b><AnimatedNumber value={45000} suffix="+" /></b> assisted drivers</span></span></div>
        <StaggerGroup className="cjir-testimonial-grid">{testimonials.map(([initials, name, location, quote]) => <StaggerItem className="cjir-testimonial-card" key={name}><figure><div className="cjir-card-content"><blockquote>{quote}</blockquote><figcaption><span className="cjir-testimonial-avatar">{initials}</span><div><strong>{name}</strong><small>{location}</small></div><span className="cjir-testimonial-check" aria-label="Driver review">✓</span></figcaption></div></figure></StaggerItem>)}</StaggerGroup>
      </div></section>

      <section className="cjir-home-faq"><div className="cjir-site-container cjir-home-faq-inner">
        <div className="cjir-home-faq-intro"><header className="cjir-section-heading"><span className="cjir-section-kicker">FAQ</span><h2>Frequently asked questions</h2><p>Answers to common questions about getting started.</p></header><div className="cjir-home-faq-help"><div><strong>Prefer to talk?</strong><span>Our team is here to help.</span></div><a className="cjir-home-faq-phone" href="tel:4348496895" aria-label="Call 434-849-6895"><span className="cjir-home-faq-phone-icon"><Phone size={20} strokeWidth={2.5} aria-hidden="true" /></span><span>434-849-6895</span></a></div></div>
        <div className="cjir-home-faq-content"><FaqAccordion items={FAQS.slice(0, 4)} /><Link className="cjir-primary-link" href="/faq">View all FAQs <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </div></section>

      <section className="cjir-home-location"><div className="cjir-site-container cjir-location-grid"><div className="cjir-location-copy"><span className="cjir-section-kicker">OUR OFFICE</span><h2>Find The Collision Justice</h2><p>310 Oakley Avenue<br />Lynchburg, VA 24501</p><a className="cjir-primary-link" href="https://www.google.com/maps/search/?api=1&query=310+Oakley+Avenue+Lynchburg+VA+24501" target="_blank" rel="noreferrer">Get directions <span aria-hidden="true">→</span></a></div><aside className="cjir-location-card" aria-label="Office location and visiting information"><div className="cjir-location-card-map" aria-hidden="true"><span className="cjir-location-road road-one" /><span className="cjir-location-road road-two" /><span className="cjir-location-pin"><MapPin size={24} fill="currentColor" /></span><span className="cjir-location-map-label">LYNCHBURG, VIRGINIA</span></div><div className="cjir-location-card-details"><div><span className="cjir-location-detail-icon"><MapPin size={17} aria-hidden="true" /></span><p><strong>The Collision Justice</strong><span>310 Oakley Avenue, Lynchburg, VA 24501</span></p></div><div><span className="cjir-location-detail-icon"><Clock3 size={17} aria-hidden="true" /></span><p><strong>Office hours</strong><a href="tel:4348496895">Call to confirm current availability · 434-849-6895</a></p></div><a href="https://www.google.com/maps/search/?api=1&query=310+Oakley+Avenue+Lynchburg+VA+24501" target="_blank" rel="noreferrer">Open directions <ArrowRight size={16} aria-hidden="true" /></a></div></aside></div></section>

      <section className="cjir-home-cta"><div className="cjir-site-container"><div className="cjir-home-cta-inner"><div className="cjir-home-cta-copy"><span className="cjir-section-kicker">START HERE</span><h2>Take the next step at your pace.</h2><p>Tell us what happened. Our team will review your request and explain what information may help.</p></div><Link className="cjir-cta-phone" href="/get-a-quote">Start a claim <span aria-hidden="true">→</span></Link></div></div></section>
      <p className="cjir-disclosure cjir-home-disclosure">{BRAND.disclosure}</p>
    </main>
  );
}