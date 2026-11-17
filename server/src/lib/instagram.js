const config = require('../config');
const { fetchJson, ApiError } = require('./http');

// Instagram API with Instagram Login (no Facebook Page needed).
// Endpoints/metrics checked against Meta's docs, Nov 2026 (Graph API v27.0).
const SCOPES = ['instagram_business_basic', 'instagram_business_manage_insights'];
const graph = () => `https://graph.instagram.com/${config.instagram.graphVersion}`;

function authorizeUrl(state) {
  const qs = new URLSearchParams({
    client_id: config.instagram.appId,
    redirect_uri: config.instagram.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(','),
    state,
    // No force_reauth: if the browser is already logged in to instagram.com, Instagram
    // goes straight to the Allow screen instead of asking for the password again.
    // Set INSTAGRAM_FORCE_REAUTH=true to always ask (e.g. on shared devices).
    ...(process.env.INSTAGRAM_FORCE_REAUTH === 'true' ? { force_reauth: 'true' } : {}),
  });
  return `https://www.instagram.com/oauth/authorize?${qs}`;
}

/** Authorization code → short-lived token (1h) + Instagram user id + granted permissions. */
async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: config.instagram.appId,
    client_secret: config.instagram.appSecret,
    grant_type: 'authorization_code',
    redirect_uri: config.instagram.redirectUri,
    code: String(code).replace(/#_$/, ''),
  });
  const data = await fetchJson('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const row = Array.isArray(data.data) ? data.data[0] : data; // docs show both shapes
  if (!row?.access_token) throw new ApiError('Instagram didn’t return a token', 502, data);
  return {
    accessToken: row.access_token,
    userId: String(row.user_id ?? ''),
    permissions: String(row.permissions ?? '').split(',').filter(Boolean),
  };
}

/** Labels an Instagram API error with the step that failed (for logs), keeping status/body. */
function stepError(step, err) {
  const trace = err.body?.error?.fbtrace_id ? ` [fbtrace ${err.body.error.fbtrace_id}]` : '';
  const e = new ApiError(`${step}: ${err.message}${trace}`, err.status, err.body);
  e.step = step;
  return e;
}

/** Tries each URL in turn; returns the first success, or throws the last error. */
async function firstOk(step, urls, opts) {
  let last;
  for (const url of urls) {
    try {
      return await fetchJson(url, opts);
    } catch (err) {
      last = err;
      if (err.status && err.status >= 500) break;
      console.warn(`[instagram] ${step} attempt failed (${err.status || ''} ${err.message}); trying next`);
    }
  }
  throw stepError(step, last);
}

/**
 * Short-lived → long-lived token (~60 days). If Instagram refuses every variant we keep the
 * short-lived token (1 hour) so the connect still succeeds; the creator reconnects later.
 */
async function toLongLived(shortToken) {
  const qs = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: config.instagram.appSecret, access_token: shortToken });
  try {
    const data = await firstOk('long-lived token', [
      `https://graph.instagram.com/access_token?${qs}`,
      `https://graph.instagram.com/${config.instagram.graphVersion}/access_token?${qs}`,
    ]);
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + Number(data.expires_in || 0) * 1000), longLived: true };
  } catch (err) {
    console.warn(`[instagram] ${err.message}. Using the short-lived token for now.`);
    return { accessToken: shortToken, expiresAt: new Date(Date.now() + 55 * 60 * 1000), longLived: false };
  }
}

/** Refresh a long-lived token (must be ≥24h old and not expired). */
async function refreshToken(longToken) {
  const qs = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: longToken });
  const data = await fetchJson(`https://graph.instagram.com/refresh_access_token?${qs}`);
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + Number(data.expires_in || 0) * 1000) };
}

/**
 * The connected account's profile. Falls back to fewer fields, an unversioned URL, and the
 * numeric user id, because Instagram rejects whole requests if any one part is unsupported.
 */
async function getProfile(token, userId) {
  const full = 'user_id,username,name,account_type,profile_picture_url,followers_count,media_count';
  const basic = 'user_id,username,account_type';
  const q = (fields) => new URLSearchParams({ fields, access_token: token });
  const urls = [
    `${graph()}/me?${q(full)}`,
    `${graph()}/me?${q(basic)}`,
    `https://graph.instagram.com/me?${q(basic)}`,
    ...(userId ? [`${graph()}/${userId}?${q(basic)}`, `https://graph.instagram.com/${userId}?${q('id,username,account_type')}`] : []),
  ];
  const raw = await firstOk('profile', urls);
  const p = Array.isArray(raw.data) ? raw.data[0] : raw.data && !Array.isArray(raw.data) ? raw.data : raw;
  return {
    id: String(p.user_id || p.id || userId),
    username: p.username || '',
    name: p.name || '',
    accountType: p.account_type || '',
    avatarUrl: p.profile_picture_url || '',
    followers: p.followers_count != null ? Number(p.followers_count) : null,
    mediaCount: p.media_count != null ? Number(p.media_count) : null,
  };
}

/** Shortcode from a post/reel link: instagram.com/reel/<code>/, /p/<code>/, /reels/<code>/. */
function parseShortcode(input) {
  let url;
  try {
    url = new URL(String(input).trim());
  } catch {
    return null;
  }
  if (!/(^|\.)instagram\.com$/.test(url.hostname)) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  const i = parts.findIndex((p) => ['reel', 'reels', 'p', 'tv'].includes(p));
  const code = i >= 0 ? parts[i + 1] : null;
  return code && /^[\w-]{5,}$/.test(code) ? code : null;
}

const MEDIA_FIELDS = 'id,permalink,shortcode,media_type,timestamp,thumbnail_url,caption,like_count,comments_count';

/**
 * Finds one of the user's own posts by link. Pages through recent media (newest first).
 * Returns null if the post isn't on this account — that's how we prove ownership.
 */
async function findOwnMedia(token, igUserId, link, { maxPages = 10 } = {}) {
  const code = parseShortcode(link);
  if (!code) return null;
  let url = `${graph()}/${igUserId}/media?${new URLSearchParams({ fields: MEDIA_FIELDS, limit: '50', access_token: token })}`;
  for (let page = 0; url && page < maxPages; page++) {
    const data = await fetchJson(url);
    const hit = (data.data || []).find((m) => m.shortcode === code || parseShortcode(m.permalink) === code);
    if (hit) return hit;
    url = data.paging?.next || null;
  }
  return null;
}

const REEL_METRICS = ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'ig_reels_avg_watch_time'];
const BASIC_METRICS = ['reach', 'likes', 'comments', 'shares', 'saved'];

/**
 * Lifetime insights for one media item. Video/Reels get view metrics.
 * If a metric isn't supported, Meta errors the whole call, so we retry with a smaller set.
 * Note: Instagram says data can lag up to 48 hours.
 */
async function getInsights(token, media) {
  const sets = media.media_type === 'VIDEO' ? [REEL_METRICS, ['views', ...BASIC_METRICS], BASIC_METRICS] : [['views', ...BASIC_METRICS], BASIC_METRICS];
  let lastErr;
  for (const metrics of sets) {
    try {
      const data = await fetchJson(`${graph()}/${media.id}/insights?${new URLSearchParams({ metric: metrics.join(','), access_token: token })}`);
      const out = {};
      for (const row of data.data || []) out[row.name] = Number(row.values?.[0]?.value ?? row.total_value?.value ?? 0);
      return {
        views: out.views ?? null,
        reach: out.reach ?? null,
        likes: out.likes ?? (media.like_count != null ? Number(media.like_count) : null),
        comments: out.comments ?? (media.comments_count != null ? Number(media.comments_count) : null),
        shares: out.shares ?? null,
        saves: out.saved ?? null,
        avgWatchTimeMs: out.ig_reels_avg_watch_time ?? null,
      };
    } catch (err) {
      lastErr = err;
      if (err.status && err.status !== 400) break; // only retry "unsupported metric" errors
    }
  }
  throw lastErr;
}

module.exports = { SCOPES, authorizeUrl, exchangeCode, toLongLived, refreshToken, getProfile, parseShortcode, findOwnMedia, getInsights };
