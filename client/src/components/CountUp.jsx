import { useEffect, useRef, useState } from 'react';

// Matches values like "₹21,000", "4.8L", "26.9K", "1.2Cr", "940", "68%".
const PATTERN = /^(₹)?([\d,]+(?:\.\d+)?)(K|L|Cr|%)?$/;

/**
 * Counts a displayed number up from zero the first time it appears.
 * Anything that isn't a plain formatted number (e.g. "—") renders as-is.
 */
export default function CountUp({ value, duration = 900 }) {
  const text = String(value ?? '');
  const m = PATTERN.exec(text);
  const [shown, setShown] = useState(m ? text.replace(/[\d.]/g, (c) => (c === '.' ? '.' : '0')) : text);
  const started = useRef(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!m) {
      setShown(text);
      return undefined;
    }
    const [, prefix = '', digits, suffix = ''] = m;
    const target = Number(digits.replace(/,/g, ''));
    const decimals = (digits.split('.')[1] || '').length;
    const grouped = digits.includes(',');
    const fmt = (n) => {
      const fixed = n.toFixed(decimals);
      const out = grouped ? Number(fixed).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : fixed;
      return `${prefix}${out}${suffix}`;
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Only animate the first time; later changes (refresh, new data) snap.
    if (reduce || started.current || target === 0) {
      setShown(text);
      started.current = true;
      return undefined;
    }
    started.current = true;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(p === 1 ? text : fmt(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return <span ref={ref}>{shown}</span>;
}
