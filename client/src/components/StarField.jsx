import { useEffect, useRef } from 'react';

/**
 * Background star field in yellow shades: dots and four-point sparkles (like the logo)
 * drift smoothly toward the viewer, slowly turning and twinkling, with an occasional
 * shooting star, and big colourful stars that pop up here and there, turn, twinkle and fade.
 * Canvas, capped frame work, pauses when the tab is hidden.
 * People who ask for reduced motion get a still field.
 */
const DARK = ['#f2c760', '#e0a526', '#ffe08a', '#d4931a', '#fff3c4'];
const LIGHT = ['#c98a12', '#a86f00', '#d9a021', '#8a5d00', '#e0a526'];
// Big pop-up stars: mostly yellow, with a few bright colours mixed in.
const POP_DARK = ['#f2c760', '#e0a526', '#ffe08a', '#ffffff', '#ff7eb6', '#7cc4ff', '#6ee7b7', '#ffb35c', '#f2c760'];
const POP_LIGHT = ['#d9a021', '#a86f00', '#e0457b', '#2b8ae0', '#12a37a', '#e8791a', '#c98a12'];

const isLight = () => {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
};

function sparkle(ctx, x, y, r, rot) {
  // Four-point star with curved sides.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const tip = [Math.cos(a) * r, Math.sin(a) * r];
    const next = [Math.cos(a + Math.PI / 2) * r, Math.sin(a + Math.PI / 2) * r];
    if (i === 0) ctx.moveTo(tip[0], tip[1]);
    ctx.quadraticCurveTo(0, 0, next[0], next[1]);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export default function StarField() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let stars = [];
    let shooting = null;
    let nextShot = performance.now() + 4000;
    let raf = 0;
    let last = performance.now();
    let palette = isLight() ? LIGHT : DARK;
    let popPalette = isLight() ? POP_LIGHT : POP_DARK;
    let pops = [];
    let nextPop = performance.now() + 600;

    const makeStar = (fresh) => ({
      // Position in a 3D box; z goes from far (1) to near (0).
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: fresh ? 1 : Math.random() * 0.9 + 0.1,
      color: palette[Math.floor(Math.random() * palette.length)],
      kind: Math.random() < 0.22 ? 'sparkle' : 'dot',
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.6,
      tw: Math.random() * Math.PI * 2,
    });

    // Big stars only appear over empty background, never behind cards, text or buttons.
    const BUSY = '.glass, .glass-solid, h1, h2, h3, p, a, button, input, img, video, label, li, nav, header, footer';
    const emptySpot = () => {
      for (let i = 0; i < 8; i++) {
        const x = 40 + Math.random() * (w - 80);
        const y = 80 + Math.random() * (h - 120);
        const r = 26;
        const clear = [[x, y], [x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]].every(([px, py]) => {
          const el = document.elementFromPoint(px, py);
          return !el || !el.closest(BUSY);
        });
        if (clear) return [x, y];
      }
      return null;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = w < 768 ? 55 : 110;
      stars = Array.from({ length: count }, () => makeStar(false));
    };

    const draw = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h * 0.42;
      const scale = Math.max(w, h) * 0.6;

      for (const s of stars) {
        if (!still) {
          s.z -= dt * 0.045; // slow, smooth approach
          s.rot += s.spin * dt;
          s.tw += dt * 2;
        }
        if (s.z <= 0.02) Object.assign(s, makeStar(true));
        const px = cx + (s.x / s.z) * scale * 0.5;
        const py = cy + (s.y / s.z) * scale * 0.5;
        if (px < -40 || px > w + 40 || py < -40 || py > h + 40) {
          Object.assign(s, makeStar(true));
          continue;
        }
        const near = 1 - s.z; // 0 far → 1 near
        const twinkle = 0.75 + Math.sin(s.tw) * 0.25;
        ctx.globalAlpha = Math.min(1, near * 1.4) * 0.85 * twinkle;
        ctx.fillStyle = s.color;
        if (s.kind === 'sparkle') {
          sparkle(ctx, px, py, 1.5 + near * 7, s.rot);
        } else {
          ctx.beginPath();
          ctx.arc(px, py, 0.5 + near * 1.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Occasional shooting star with a fading yellow tail.
      if (!still && !shooting && now > nextShot) {
        const fromLeft = Math.random() < 0.5;
        shooting = { x: fromLeft ? Math.random() * w * 0.5 : w * 0.5 + Math.random() * w * 0.5, y: Math.random() * h * 0.35, vx: (fromLeft ? 1 : -1) * (w * 0.55), vy: h * 0.28, life: 0 };
        nextShot = now + 6000 + Math.random() * 7000;
      }
      if (shooting) {
        shooting.life += dt;
        shooting.x += shooting.vx * dt;
        shooting.y += shooting.vy * dt;
        const len = 0.12;
        const grad = ctx.createLinearGradient(shooting.x, shooting.y, shooting.x - shooting.vx * len, shooting.y - shooting.vy * len);
        grad.addColorStop(0, palette[2]);
        grad.addColorStop(1, 'transparent');
        ctx.globalAlpha = Math.max(0, 1 - shooting.life / 1.3) * 0.9;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(shooting.x, shooting.y);
        ctx.lineTo(shooting.x - shooting.vx * len, shooting.y - shooting.vy * len);
        ctx.stroke();
        if (shooting.life > 1.3) shooting = null;
      }
      // Big stars popping up here and there.
      if (!still && now > nextPop && pops.length < (w < 768 ? 3 : 6)) {
        nextPop = now + 700 + Math.random() * 900;
        const spot = emptySpot();
        if (spot) pops.push({
          x: spot[0],
          y: spot[1],
          r: (w < 768 ? 9 : 12) + Math.random() * (w < 768 ? 9 : 16),
          color: popPalette[Math.floor(Math.random() * popPalette.length)],
          rot: Math.random() * Math.PI,
          spin: (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.8),
          life: 0,
          dur: 2.6 + Math.random() * 1.6,
        });
      }
      pops = pops.filter((p) => p.life < p.dur);
      for (const p of pops) {
        p.life += dt;
        p.rot += p.spin * dt;
        const t = p.life / p.dur; // 0 → 1
        // Grow in quickly with a little overshoot, hold, then shrink away.
        const grow = t < 0.25 ? 1 - Math.pow(1 - t / 0.25, 3) * (1 - 0.15 * Math.sin((t / 0.25) * Math.PI)) : t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
        const twinkle = 0.85 + Math.sin(p.life * 6) * 0.15;
        ctx.globalAlpha = Math.max(0, grow) * 0.9 * twinkle;
        ctx.fillStyle = p.color;
        sparkle(ctx, p.x, p.y, p.r * Math.max(0, grow), p.rot);
        // A small companion sparkle for a bit of fun.
        ctx.globalAlpha *= 0.7;
        sparkle(ctx, p.x + p.r * 1.1, p.y - p.r * 0.9, p.r * 0.35 * Math.max(0, grow), -p.rot * 1.5);
      }

      ctx.globalAlpha = 1;
      if (!still) raf = requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !still) {
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };
    // Recolour when the theme changes.
    const themeWatch = new MutationObserver(() => {
      palette = isLight() ? LIGHT : DARK;
      popPalette = isLight() ? POP_LIGHT : POP_DARK;
      for (const s of stars) s.color = palette[Math.floor(Math.random() * palette.length)];
      if (still) draw(performance.now());
    });

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      themeWatch.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="backdrop__stars" aria-hidden />;
}
