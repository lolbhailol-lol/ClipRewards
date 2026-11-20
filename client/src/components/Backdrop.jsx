import { useEffect } from 'react';
import StarField from './StarField';

/**
 * App-wide atmosphere: a star field flying toward you with big colourful stars popping up, a faint grid and film grain,
 * fixed behind every page.
 * Also powers the cursor spotlight on `.glass` cards (sets --mx/--my on the hovered card).
 */
export default function Backdrop() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let frame = 0;
    let last = null;
    const onMove = (e) => {
      const target = e.target instanceof Element ? e.target.closest('.glass') : null;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (last && last !== target) {
          last.style.removeProperty('--mx');
          last.style.removeProperty('--my');
        }
        if (target) {
          const r = target.getBoundingClientRect();
          target.style.setProperty('--mx', `${e.clientX - r.left}px`);
          target.style.setProperty('--my', `${e.clientY - r.top}px`);
        }
        last = target;
      });
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="backdrop" aria-hidden>
      <div className="backdrop__spotlight" />
      <div className="backdrop__edge" />
      <div className="backdrop__grid" />
      <StarField />
      <div className="backdrop__vignette" />
      <div className="backdrop__grain" />
    </div>
  );
}
