const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** ₹ from paise, Indian digit grouping (₹1,00,000). */
export const rupees = (paise) => inr.format(Math.round((paise || 0) / 100));

/** Compact Indian count: 4.2L, 1.1Cr, 12K. */
export function compact(n = 0) {
  if (n >= 1e7) return `${+(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `${+(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(n);
}

export const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const VERTICALS = [
  { value: 'genz', label: 'Gen Z & college' },
  { value: 'podcast', label: 'Podcasts' },
  { value: 'music', label: 'Music' },
  { value: 'regional', label: 'Regional language' },
  { value: 'other', label: 'Other' },
];

export const verticalLabel = (v) => VERTICALS.find((x) => x.value === v)?.label ?? 'Other';

/** ₹ per 1K views from paise, e.g. 5000 → "₹50". Keeps paise when not whole. */
export const ratePer1k = (paise = 0) => (paise % 100 ? `₹${(paise / 100).toFixed(2)}` : `₹${paise / 100}`);

/** Whole days until a date (0 when past). */
export const daysLeft = (date) => Math.max(0, Math.ceil((new Date(date) - Date.now()) / 86400000));

/** Only allow in-app paths as a post-login redirect. */
export const safeNext = (next) => (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : null);

/** Sized image URL. Unsplash images get resize params; other URLs pass through. */
export function img(url, w = 800) {
  if (!url) return url;
  if (url.includes('images.unsplash.com')) return `${url}?w=${w}&q=72&auto=format&fit=crop`;
  // Cloudinary: insert a resize + auto format/quality transform.
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) return url.replace('/upload/', `/upload/c_limit,w_${w},q_auto,f_auto/`);
  return url;
}
