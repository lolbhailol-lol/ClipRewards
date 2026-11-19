/**
 * Generated profile icon in the CreatorPerks logo style: a rounded square with a
 * mirrored 5×5 pattern unique to each person (same name → same icon).
 */
function hash(str) {
  // FNV-1a, 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export default function IdentityIcon({ seed = '', className = 'size-9', title }) {
  let h = hash(seed.trim().toLowerCase() || 'cliprewards');
  const cells = [];
  // 3 columns are random, the other 2 mirror them → symmetric like a logo.
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if (h & 1) {
        cells.push([x, y]);
        if (x < 2) cells.push([4 - x, y]);
      }
      h = (h >>> 1) | ((h & 1) << 31);
    }
  }
  // Never empty: always light the centre column top and bottom.
  if (cells.length < 4) cells.push([2, 0], [2, 4], [1, 2], [3, 2]);

  return (
    <svg viewBox="0 0 32 32" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="32" height="32" rx="9" fill="var(--text)" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={6 + x * 4} y={6 + y * 4} width="4" height="4" rx="0.8" fill="var(--bg)" />
      ))}
    </svg>
  );
}
