'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';

export default function FaqAccordion({ items }: { items: readonly (readonly [string, string])[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const reduceMotion = useReducedMotion();
  return <div className="cjir-faq-list">{items.map(([question, answer], index) => {
    const expanded = open === index;
    const panelId = `faq-answer-${index}`;
    return <motion.section className="cjir-faq-item" key={question} layout transition={{ duration: reduceMotion ? 0 : 0.24 }}>
      <h2><button id={`faq-question-${index}`} className="cjir-faq-trigger" type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpen(expanded ? null : index)}>{question}<span className="cjir-faq-icon-badge" aria-hidden="true">{expanded ? <Minus size={17} /> : <Plus size={17} />}</span></button></h2>
      <AnimatePresence initial={false}>{expanded && <motion.div id={panelId} aria-labelledby={`faq-question-${index}`} className="cjir-faq-answer" initial={reduceMotion ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={reduceMotion ? undefined : { height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}><p>{answer}</p></motion.div>}</AnimatePresence>
    </motion.section>;
  })}</div>;
}