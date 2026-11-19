const { Router } = require('express');
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const config = require('../config');
const SocialAccount = require('../models/SocialAccount');
const User = require('../models/User');
const instagram = require('../lib/instagram');
const youtube = require('../lib/youtube');
const { encrypt, decrypt } = require('../lib/crypto');
const insights = require('../lib/insights');
const InsightsCache = require('../models/InsightsCache');
const { requireAuth, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = Router();

const igReady = () => Boolean(config.instagram.appId && config.instagram.appSecret);

/** Only in-app paths are allowed as a return destination. */
const safePath = (p) => (typeof p === 'string' && /^\/(app|onboarding)(\/[\w\-/]*)?$/.test(p) ? p : '/app/profile');
/** Only known web origins (CLIENT_ORIGIN, the callback host, localhost in dev). */
const safeOrigin = (o) => (config.allowedOrigins.includes(o) ? o : config.clientOrigin);

/** Duplicate key on (platform, externalId) → this account is already someone else's. */
const isDup = (err) => err?.code === 11000;

/* ---------------- Instagram OAuth callback (no session: the browser comes back from Instagram) ---------------- */

router.get('/instagram/callback', async (req, res) => {
  const { code, state, error, error_reason: reason } = req.query;

  // The signed state says who is connecting and where to send them back (the exact
  // site they started on, so they stay signed in — e.g. localhost while the callback is on ngrok).
  let userId;
  let dest = { origin: config.clientOrigin, path: '/app/profile' };
  let stateOk = false;
  try {
    const st = jwt.verify(String(state || ''), config.jwtSecret, { audience: 'ig-connect' });
    userId = st.sub;
    dest = { origin: safeOrigin(st.origin), path: safePath(st.returnTo) };
    stateOk = true;
  } catch {
    /* fall through with the default destination */
  }
  const back = (qs) => res.redirect(`${dest.origin}${dest.path}?${new URLSearchParams(qs)}`);

  if (error) return back({ social_error: reason === 'user_denied' ? 'instagram_cancelled' : 'instagram_failed' });
  if (!stateOk) return back({ social_error: 'instagram_expired' });
  if (!code) return back({ social_error: 'instagram_failed', step: 'no_code' });

  // iPhone Safari sometimes loads this URL twice. The code works only once, so the second
  // load waits for the first one's result instead of failing with "code already used".
  const key = `${state}|${code}`;
  if (!inflight.has(key)) {
    inflight.set(key, connectInstagram(userId, code));
    setTimeout(() => inflight.delete(key), 5 * 60 * 1000).unref?.();
  }
  return back(await inflight.get(key));
});

const inflight = new Map(); // code → Promise<redirect query>

/**
 * The profile, trying the long-lived token, then the short-lived one. If Instagram still
 * refuses, the account is saved with just its id (we already know it from the token
 * exchange); the username fills in on the next Insights refresh.
 */
async function readProfile(longToken, short) {
  try {
    return await instagram.getProfile(longToken, short.userId);
  } catch (err) {
    if (longToken !== short.accessToken) {
      try {
        return await instagram.getProfile(short.accessToken, short.userId);
      } catch {
        /* fall through */
      }
    }
    if (!short.userId) throw err;
    console.warn(`[social] Instagram profile unavailable (${err.message}); saving with id only`);
    return { id: short.userId, username: '', name: 'Instagram account', accountType: '', avatarUrl: '', followers: null, mediaCount: null };
  }
}

/** Exchanges the code, saves the account. Returns the query string for the redirect back. */
async function connectInstagram(userId, code) {
  let step = 'start';
  try {
    const user = await User.findById(userId);
    if (!user || user.role !== 'creator') return { social_error: 'instagram_failed', step: 'user' };

    step = 'code';
    let short;
    try {
      short = await instagram.exchangeCode(code);
    } catch (err) {
      err.message = `code exchange: ${err.message}`;
      throw err;
    }
    step = 'token';
    const long = await instagram.toLongLived(short.accessToken);
    step = 'profile';
    const profile = await readProfile(long.accessToken, short);

    // Instagram Login only works for professional accounts; if the type wasn't returned, let it through.
    if (profile.accountType && !['BUSINESS', 'MEDIA_CREATOR'].includes(String(profile.accountType).toUpperCase())) {
      return { social_error: 'instagram_not_professional' };
    }

    step = 'save';
    await SocialAccount.findOneAndUpdate(
      { userId: user._id, platform: 'instagram' },
      {
        externalId: profile.id,
        username: profile.username,
        displayName: profile.name,
        avatarUrl: profile.avatarUrl,
        accountType: profile.accountType,
        followers: profile.followers,
        mediaCount: profile.mediaCount,
        accessTokenEnc: encrypt(long.accessToken),
        tokenExpiresAt: long.expiresAt,
        tokenRefreshedAt: new Date(),
        permissions: short.permissions,
        status: 'active',
        lastSyncedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await User.updateOne(
      { _id: user._id },
      { $set: { 'creator.igAccess.status': 'connected', ...(profile.username ? { 'creator.instagram': profile.username } : {}) } }
    );
    return { connected: 'instagram' };
  } catch (err) {
    if (isDup(err)) return { social_error: 'instagram_taken' };
    console.warn(`[social] Instagram connect failed at ${step}:`, err.status || '', err.message);
    // Code already used (e.g. a second server instance got the repeat load): if this user's
    // Instagram was saved in the last few minutes, the first load worked, so report success.
    if (step === 'code') {
      const recent = await SocialAccount.findOne({ userId, platform: 'instagram', status: 'active', lastSyncedAt: { $gt: new Date(Date.now() - 3 * 60 * 1000) } }).catch(() => null);
      if (recent) return { connected: 'instagram' };
    }
    return { social_error: 'instagram_failed', step };
  }
}

/* ---------------- Everything below needs a signed-in creator ---------------- */

router.use(requireAuth, requireRole('creator'));

router.get('/accounts', async (req, res) => {
  const accounts = await SocialAccount.find({ userId: req.user._id });
  res.json({
    accounts: accounts.map((a) => a.toPublic()),
    available: { instagram: igReady(), instagramOpen: config.instagram.open, youtube: Boolean(config.firebaseProjectId), youtubeStats: Boolean(config.youtubeApiKey) },
  });
});

/** Instagram early access: the creator asks to be added as a tester in Meta. */
const IG_HANDLE = /^[a-z0-9._]{1,30}$/;
const igHandle = z
  .string()
  .trim()
  .transform((v) => v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '').toLowerCase())
  .refine((v) => IG_HANDLE.test(v), { message: 'Enter your Instagram username, like riya.edits' });

router.post('/instagram/request', validate(z.object({ username: igHandle })), async (req, res) => {
  const acc = req.user.creator.igAccess || {};
  const same = acc.username === req.body.username && ['invited', 'connected'].includes(acc.status);
  req.user.creator.igAccess = same ? acc : { status: 'requested', username: req.body.username, requestedAt: new Date() };
  await req.user.save();
  res.json({ user: req.user.toPublic() });
});

router.get('/instagram/start', (req, res) => {
  if (!igReady()) return res.status(503).json({ error: 'Instagram connect isn’t set up on the server yet' });
  const state = jwt.sign(
    { sub: req.user._id.toString(), origin: safeOrigin(String(req.query.origin || '')), returnTo: safePath(req.query.returnTo) },
    config.jwtSecret,
    { audience: 'ig-connect', expiresIn: '30m' } // time to log in to Instagram (password, 2-step code)
  );
  res.json({ url: instagram.authorizeUrl(state) });
});

/** YouTube: the app gets a short-lived Google token (youtube.readonly) and sends it once to prove channel ownership. */
router.post('/youtube/connect', validate(z.object({ accessToken: z.string().min(20) })), async (req, res) => {
  let channel;
  try {
    channel = await youtube.getMyChannel(req.body.accessToken);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message, code: 'no_channel' });
    const reason = err.body?.error?.errors?.[0]?.reason || '';
    console.warn('[social] YouTube connect failed:', err.status || '', reason, err.message);
    // Google's consent screen has a checkbox per permission; unticked = token without YouTube access.
    if (err.status === 403 && /insufficientPermissions|forbidden|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(reason + err.message)) {
      return res.status(400).json({ error: 'Google didn’t give YouTube access. Try again and tick “View your YouTube account” on the Google screen.', code: 'scope_missing' });
    }
    if (reason === 'youtubeSignupRequired') return res.status(404).json({ error: 'This Google account has no YouTube channel. Pick the account that owns your channel.', code: 'no_channel' });
    if (err.status === 401) return res.status(400).json({ error: 'Google sign-in expired. Please try again.', code: 'expired' });
    if (err.status === 403 && /accessNotConfigured|SERVICE_DISABLED/i.test(reason + err.message)) {
      return res.status(503).json({ error: 'YouTube API isn’t enabled for this app yet.', code: 'api_disabled' });
    }
    return res.status(502).json({ error: 'Couldn’t read your YouTube channel. Please try again.' });
  }
  try {
    const acc = await SocialAccount.findOneAndUpdate(
      { userId: req.user._id, platform: 'youtube' },
      {
        externalId: channel.id,
        username: channel.handle,
        displayName: channel.title,
        avatarUrl: channel.avatarUrl,
        followers: channel.subscribers,
        mediaCount: channel.videoCount,
        status: 'active',
        lastSyncedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    req.user.creator.youtube = channel.handle || channel.title;
    await req.user.save();
    res.json({ account: acc.toPublic() });
  } catch (err) {
    if (isDup(err)) return res.status(409).json({ error: 'This YouTube channel is already connected to another ClipRewards account' });
    throw err;
  }
});

const FRESH_MS = 60 * 60 * 1000; // serve cached dashboards for an hour
const MIN_REFRESH_MS = 5 * 60 * 1000; // manual refresh at most every 5 minutes

/** Insights dashboard for a connected account. ?days=7|30|90, ?refresh=1 to bypass the cache. */
router.get('/:platform/insights', async (req, res) => {
  const { platform } = req.params;
  if (!SocialAccount.PLATFORMS.includes(platform)) return res.status(404).json({ error: 'Not found' });
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;

  const acc = await SocialAccount.findOne({ userId: req.user._id, platform }).select('+accessTokenEnc');
  if (!acc) return res.status(404).json({ error: `Connect your ${platform === 'instagram' ? 'Instagram account' : 'YouTube channel'} to see insights`, code: 'not_connected' });
  if (acc.status === 'expired') return res.status(400).json({ error: 'Your Instagram connection expired. Please reconnect.', code: 'expired' });

  const cached = await InsightsCache.findOne({ accountId: acc._id, days });
  const age = cached ? Date.now() - cached.fetchedAt.getTime() : Infinity;
  const wantsRefresh = req.query.refresh === '1' && age > MIN_REFRESH_MS;
  if (cached && age < FRESH_MS && !wantsRefresh) return res.json({ ...cached.data, fetchedAt: cached.fetchedAt, cached: true });

  try {
    const data =
      platform === 'instagram' ? await insights.instagramInsights(acc, decrypt(acc.accessTokenEnc), days) : await insights.youtubeInsights(acc, days);

    // Keep the stored profile fresh while we're here.
    const p = data.account;
    acc.set({ username: p.username || acc.username, displayName: p.displayName || acc.displayName, avatarUrl: p.avatarUrl || acc.avatarUrl, followers: p.followers ?? acc.followers, mediaCount: p.mediaCount ?? acc.mediaCount, lastSyncedAt: new Date() });
    await acc.save();
    delete data.profileUpdate;

    const fetchedAt = new Date();
    await InsightsCache.updateOne({ accountId: acc._id, days }, { data, fetchedAt }, { upsert: true });
    res.json({ ...data, fetchedAt, cached: false });
  } catch (err) {
    if (platform === 'instagram' && (err.status === 401 || err.body?.error?.code === 190)) {
      acc.status = 'expired';
      await acc.save();
      return res.status(400).json({ error: 'Your Instagram connection expired. Please reconnect.', code: 'expired' });
    }
    if (err.status === 503) return res.status(503).json({ error: err.message, code: 'not_configured' });
    console.warn(`[social] ${platform} insights failed:`, err.status || '', err.message);
    // Serve stale data rather than nothing.
    if (cached) return res.json({ ...cached.data, fetchedAt: cached.fetchedAt, cached: true, stale: true });
    res.status(502).json({ error: `Couldn’t load ${platform === 'instagram' ? 'Instagram' : 'YouTube'} insights. Try again in a minute.` });
  }
});

router.delete('/:platform', async (req, res) => {
  if (!SocialAccount.PLATFORMS.includes(req.params.platform)) return res.status(404).json({ error: 'Not found' });
  const acc = await SocialAccount.findOneAndDelete({ userId: req.user._id, platform: req.params.platform });
  if (acc) await InsightsCache.deleteMany({ accountId: acc._id });
  res.json({ ok: true });
});

/**
 * Check a post: confirms the link is on the creator's connected account and returns live stats.
 * This is the building block for clip submissions and view tracking.
 */
router.post('/check', validate(z.object({ url: z.string().trim().url('Paste a full link') })), async (req, res) => {
  const { url } = req.body;

  const videoId = youtube.parseVideoId(url);
  if (videoId) {
    const acc = await SocialAccount.findOne({ userId: req.user._id, platform: 'youtube' });
    if (!acc) return res.status(400).json({ error: 'Connect your YouTube channel first' });
    let video;
    try {
      [video] = await youtube.getVideos([videoId]);
    } catch (err) {
      return res.status(err.status === 503 ? 503 : 502).json({ error: err.status === 503 ? err.message : 'Couldn’t reach YouTube. Try again.' });
    }
    if (!video) return res.status(404).json({ error: 'Video not found or not public' });
    if (video.channelId !== acc.externalId) return res.status(403).json({ error: 'This video isn’t on your connected channel' });
    return res.json({
      platform: 'youtube',
      post: { id: video.id, url, title: video.title, thumbnailUrl: video.thumbnailUrl, publishedAt: video.publishedAt, likelyShort: video.likelyShort, durationSeconds: video.durationSeconds },
      stats: { views: video.views, likes: video.likes, comments: video.comments },
      checkedAt: new Date(),
    });
  }

  if (instagram.parseShortcode(url)) {
    const acc = await SocialAccount.findOne({ userId: req.user._id, platform: 'instagram' }).select('+accessTokenEnc');
    if (!acc) return res.status(400).json({ error: 'Connect your Instagram account first' });
    if (acc.status === 'expired') return res.status(400).json({ error: 'Your Instagram connection expired. Please reconnect.' });
    const token = decrypt(acc.accessTokenEnc);
    try {
      const media = await instagram.findOwnMedia(token, acc.externalId, url);
      if (!media) return res.status(403).json({ error: 'This post isn’t on your connected Instagram account (or is older than we can see)' });
      const stats = await instagram.getInsights(token, media);
      return res.json({
        platform: 'instagram',
        post: { id: media.id, url: media.permalink, title: (media.caption || '').slice(0, 120), thumbnailUrl: media.thumbnail_url || '', publishedAt: media.timestamp, mediaType: media.media_type },
        stats,
        checkedAt: new Date(),
        note: 'Instagram can take up to 48 hours to update these numbers.',
      });
    } catch (err) {
      if (err.status === 401 || err.body?.error?.code === 190) {
        acc.status = 'expired';
        await acc.save();
        return res.status(400).json({ error: 'Your Instagram connection expired. Please reconnect.' });
      }
      console.warn('[social] Instagram check failed:', err.status || '', err.message);
      return res.status(502).json({ error: 'Couldn’t reach Instagram. Try again.' });
    }
  }

  res.status(400).json({ error: 'Paste an Instagram Reel/post link or a YouTube Shorts/video link' });
});

/**
 * Keeps Instagram tokens alive: refreshes tokens older than a day that expire within 15 days.
 * Called on a timer from index.js.
 */
async function refreshInstagramTokens({ now = new Date() } = {}) {
  const soon = new Date(now.getTime() + 15 * 86400000);
  const dayAgo = new Date(now.getTime() - 86400000);
  const due = await SocialAccount.find({
    platform: 'instagram',
    status: 'active',
    tokenExpiresAt: { $lte: soon },
    tokenRefreshedAt: { $lte: dayAgo },
  }).select('+accessTokenEnc');
  let refreshed = 0;
  for (const acc of due) {
    try {
      const next = await instagram.refreshToken(decrypt(acc.accessTokenEnc));
      acc.accessTokenEnc = encrypt(next.accessToken);
      acc.tokenExpiresAt = next.expiresAt;
      acc.tokenRefreshedAt = now;
      refreshed++;
    } catch (err) {
      if (acc.tokenExpiresAt < now) acc.status = 'expired';
      console.warn('[social] Instagram token refresh failed:', err.message);
    }
    await acc.save();
  }
  return { checked: due.length, refreshed };
}

module.exports = router;
module.exports.refreshInstagramTokens = refreshInstagramTokens;
