'use client';

import { motion, useReducedMotion } from 'framer-motion';

export function Reveal({ children, className = '', delay = 0, as = 'div' }: { children: React.ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'article' | 'main' | 'header' }) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as];
  return <Component className={className} initial={false} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 'some' }} transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}>{children}</Component>;
}

export function StaggerGroup({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return <motion.div className={className} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 'some' }} variants={{ hidden: {}, visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.04 } } }}>{children}</motion.div>;
}

export function StaggerItem({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return <motion.div className={className} variants={{ hidden: reduceMotion ? {} : { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] } } }}>{children}</motion.div>;
}

export function AnimatedNumber({ value, suffix = '', decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const formattedValue = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return <span>{formattedValue}{suffix}</span>;
}