'use client';

import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1025px) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let pointerX = -100;
    let pointerY = -100;
    let ringX = pointerX;
    let ringY = pointerY;
    let frame = 0;
    let visible = false;
    let active = false;
    let hasPointerPosition = false;

    const animate = () => {
      ringX += (pointerX - ringX) * 0.2;
      ringY += (pointerY - ringY) * 0.2;
      ring.style.transform = `translate3d(${ringX - 16}px, ${ringY - 16}px, 0)`;
      if (Math.abs(pointerX - ringX) > 0.1 || Math.abs(pointerY - ringY) > 0.1) {
        frame = requestAnimationFrame(animate);
      } else {
        frame = 0;
      }
    };

    const show = () => {
      if (visible) return;
      visible = true;
      dot.classList.add('is-visible');
      ring.classList.add('is-visible');
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!active) return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      dot.style.transform = `translate3d(${pointerX - 3}px, ${pointerY - 3}px, 0)`;
      if (!hasPointerPosition) {
        ringX = pointerX;
        ringY = pointerY;
        ring.style.transform = `translate3d(${ringX - 16}px, ${ringY - 16}px, 0)`;
        hasPointerPosition = true;
      }
      show();

      const target = event.target instanceof Element ? event.target : null;
      const typing = Boolean(target?.closest('textarea, [contenteditable="true"], input:not([type]), input[type="text"], input[type="email"], input[type="password"], input[type="tel"], input[type="url"], input[type="search"], input[type="number"], input[type="date"], input[type="datetime-local"], input[type="month"], input[type="time"], input[type="week"]'));
      const interactive = Boolean(target?.closest('a, button, article, input:not([type="hidden"]), select, textarea, [role="button"], [role="article"], summary, label, [data-cursor-hover]'));
      dot.classList.toggle('is-hidden', typing);
      ring.classList.toggle('is-hidden', typing);
      ring.classList.toggle('is-hovering', interactive && !typing);

      if (!frame) frame = requestAnimationFrame(animate);
    };

    const hide = () => {
      visible = false;
      dot.classList.remove('is-visible');
      ring.classList.remove('is-visible', 'is-hovering');
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      hasPointerPosition = false;
    };
    const onVisibilityChange = () => {
      if (document.hidden) hide();
    };

    const activate = () => {
      if (active) return;
      active = true;
      document.addEventListener('pointermove', onPointerMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', hide);
      document.addEventListener('visibilitychange', onVisibilityChange);
    };
    const deactivate = () => {
      if (!active) return;
      active = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', hide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      hide();
    };
    const onMediaChange = () => {
      if (media.matches) activate();
      else deactivate();
    };

    media.addEventListener('change', onMediaChange);
    onMediaChange();

    return () => {
      media.removeEventListener('change', onMediaChange);
      deactivate();
    };
  }, []);

  return (
    <div className="cj-custom-cursor" aria-hidden="true">
      <span className="cj-custom-cursor-dot" ref={dotRef} />
      <span className="cj-custom-cursor-ring" ref={ringRef}>
        <span className="cj-custom-cursor-ring-inner" />
      </span>
    </div>
  );
}
