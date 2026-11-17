import { useEffect } from 'react';

/**
 * App-wide atmosphere: slow light beams from the top, drifting glow, a faint grid and film grain, fixed behind every page.
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
      <div className="backdrop__blob backdrop__blob--1" />
      <div className="backdrop__blob backdrop__blob--2" />
      <div className="backdrop__blob backdrop__blob--3" />
      <div className="backdrop__glow" />
      <div className="backdrop__beams">
        <span className="beam beam--1" />
        <span className="beam beam--2" />
        <span className="beam beam--3" />
        <span className="beam beam--4" />
        <span className="beam beam--5" />
      </div>
      <div className="backdrop__grid" />
      <div className="backdrop__vignette" />
      <div className="backdrop__grain" />
    </div>
  );
}
