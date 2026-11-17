const config = require('../config');
const { fetchJson, ApiError } = require('./http');
const instagram = require('./instagram');
const youtube = require('./youtube');

/*
 * Creator insights dashboards, one shape for both platforms:
 * { platform, account, range, totals, series[{date, reach?, views?}], posts[], notes[] }
 *
 * Instagram account insights (Instagram Login, v27.0, checked against Meta docs Nov 2026):
 *  - total_value only: views, accounts_engaged, total_interactions, likes, comments, shares, saves
 *  - reach supports time_series (daily) as well
 *  - data kept 90 days, can lag up to 48h, some metrics need 100+ followers
 *  - max since/until span isn't documented, so we query in ≤30-day windows
 */

const DAY = 86400000;
const ACCOUNT_METRICS = ['views', 'reach', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves'];
const TOTAL_KEYS = { views: 'views', reach: 'reach', accounts_engaged: 'engaged', total_interactions: 'interactions', likes: 'likes', comments: 'comments', shares: 'shares', saves: 'saves' };

const graph = () => `https://graph.instagram.com/${config.instagram.graphVersion}`;
const unix = (d) => Math.floor(d.getTime() / 1000);
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

/** [since, until] windows of at most 30 days covering the range. */
function windows(since, until) {
  const out = [];
  for (let s = since.getTime(); s < until.getTime(); s += 30 * DAY) out.push([new Date(s), new Date(Math.min(s + 30 * DAY, until.getTime()))]);
  return out;
}

/** Runs async fn over items with limited concurrency. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    })
  );
  return out;
}

const engagementRate = (p) => {
  const base = p.views || p.reach;
  if (!base) return null;
  const eng = (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
  return Math.round((eng / base) * 10000) / 100; // percent, 2 dp
};

/* ---------------- Instagram ---------------- */

async function igAccountTotals(token, igUserId, since, until, notes) {
  const totals = {};
  const missing = new Set();
  for (const [s, u] of windows(since, until)) {
    const base = { period: 'day', metric_type: 'total_value', since: unix(s), until: unix(u), access_token: token };
    let rows = null;
    try {
      const data = await fetchJson(`${graph()}/${igUserId}/insights?${new URLSearchParams({ ...base, metric: ACCOUNT_METRICS.join(',') })}`);
      rows = data.data || [];
    } catch (err) {
      if (err.status && err.status !== 400) throw err;
      // One unsupported metric fails the whole call; fall back to one call per metric.
      rows = (
        await pool(ACCOUNT_METRICS, 4, async (m) => {
          try {
            const d = await fetchJson(`${graph()}/${igUserId}/insights?${new URLSearchParams({ ...base, metric: m })}`);
            return d.data?.[0] || null;
          } catch {
            missing.add(m);
            return null;
          }
        })
      ).filter(Boolean);
    }
    for (const row of rows) {
      const key = TOTAL_KEYS[row.name];
      if (!key) continue;
      totals[key] = (totals[key] ?? 0) + Number(row.total_value?.value ?? 0);
    }
  }
  if (missing.size) notes.push(`Instagram didn’t return: ${[...missing].join(', ')}. Some metrics need 100+ followers.`);
  return totals;
}

async function igReachSeries(token, igUserId, since, until) {
  const byDay = new Map();
  for (const [s, u] of windows(since, until)) {
    try {
      const qs = new URLSearchParams({ metric: 'reach', period: 'day', metric_type: 'time_series', since: unix(s), until: unix(u), access_token: token });
      const data = await fetchJson(`${graph()}/${igUserId}/insights?${qs}`);
      for (const v of data.data?.[0]?.values || []) byDay.set(dayKey(v.end_time), Number(v.value || 0));
    } catch {
      /* reach series is a nice-to-have; totals still render */
    }
  }
  return byDay;
}

/** Recent media in range (newest first), with per-post insights. */
async function igPosts(token, igUserId, since, { max = 25 } = {}) {
  const fields = 'id,permalink,shortcode,media_type,timestamp,thumbnail_url,media_url,caption,like_count,comments_count';
  let url = `${graph()}/${igUserId}/media?${new URLSearchParams({ fields, limit: '25', access_token: token })}`;
  const media = [];
  while (url && media.length < max) {
    const data = await fetchJson(url);
    for (const m of data.data || []) {
      if (m.timestamp && new Date(m.timestamp) < since) {
        url = null;
        break;
      }
      media.push(m);
    }
    url = url && data.paging?.next;
  }
  const posts = await pool(media.slice(0, max), 5, async (m) => {
    let stats = {};
    try {
      stats = await instagram.getInsights(token, m);
    } catch {
      stats = { likes: m.like_count ?? null, comments: m.comments_count ?? null };
    }
    const p = {
      id: m.id,
      url: m.permalink,
      title: (m.caption || '').split('\n')[0].slice(0, 100),
      thumbnailUrl: m.thumbnail_url || (m.media_type === 'IMAGE' ? m.media_url : '') || '',
      mediaType: m.media_type,
      publishedAt: m.timestamp,
      ...stats,
    };
    p.engagementRate = engagementRate(p);
    return p;
  });
  return posts;
}

async function instagramInsights(account, token, days) {
  const until = new Date();
  const since = new Date(until.getTime() - days * DAY);
  const notes = ['Instagram can take up to 48 hours to update these numbers.'];

  const [profile, totals, reachByDay, posts] = await Promise.all([
    instagram.getProfile(token).catch(() => null),
    igAccountTotals(token, account.externalId, since, until, notes),
    igReachSeries(token, account.externalId, since, until),
    igPosts(token, account.externalId, since),
  ]);

  // Daily series: reach from account insights, views from posts published that day.
  const viewsByDay = new Map();
  for (const p of posts) if (p.views != null && p.publishedAt) viewsByDay.set(dayKey(p.publishedAt), (viewsByDay.get(dayKey(p.publishedAt)) ?? 0) + p.views);
  const series = [];
  for (let t = since.getTime() + DAY; t <= until.getTime(); t += DAY) {
    const k = dayKey(t);
    series.push({ date: k, reach: reachByDay.get(k) ?? null, views: viewsByDay.get(k) ?? 0 });
  }

  return {
    platform: 'instagram',
    account: {
      username: profile?.username || account.username,
      displayName: profile?.name || account.displayName,
      avatarUrl: profile?.avatarUrl || account.avatarUrl,
      followers: profile?.followers ?? account.followers,
      mediaCount: profile?.mediaCount ?? account.mediaCount,
    },
    range: { days, since, until },
    totals,
    series,
    posts: posts.sort((a, b) => (b.views ?? b.reach ?? 0) - (a.views ?? a.reach ?? 0)),
    notes,
    profileUpdate: profile,
  };
}

/* ---------------- YouTube ---------------- */

async function youtubeInsights(account, days) {
  if (!config.youtubeApiKey) throw new ApiError('YouTube stats need a YouTube API key on the server', 503);
  const until = new Date();
  const since = new Date(until.getTime() - days * DAY);
  const key = config.youtubeApiKey;
  const api = 'https://www.googleapis.com/youtube/v3';

  const ch = await fetchJson(`${api}/channels?${new URLSearchParams({ part: 'snippet,statistics,contentDetails', id: account.externalId, key })}`);
  const channel = ch.items?.[0];
  if (!channel) throw new ApiError('Channel not found', 404);
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads || `UU${account.externalId.slice(2)}`;

  const ids = [];
  let pageToken = '';
  do {
    const qs = new URLSearchParams({ part: 'contentDetails', playlistId: uploads, maxResults: '50', key, ...(pageToken ? { pageToken } : {}) });
    const pl = await fetchJson(`${api}/playlistItems?${qs}`);
    let reachedOld = false;
    for (const it of pl.items || []) {
      const at = it.contentDetails?.videoPublishedAt;
      if (at && new Date(at) < since) {
        reachedOld = true;
        break;
      }
      ids.push(it.contentDetails.videoId);
    }
    pageToken = reachedOld || ids.length >= 100 ? '' : pl.nextPageToken || '';
  } while (pageToken);

  const videos = [];
  for (let i = 0; i < ids.length; i += 50) videos.push(...(await youtube.getVideos(ids.slice(i, i + 50))));

  const posts = videos.map((v) => {
    const p = { id: v.id, url: v.likelyShort ? `https://youtube.com/shorts/${v.id}` : `https://youtube.com/watch?v=${v.id}`, title: v.title, thumbnailUrl: v.thumbnailUrl, publishedAt: v.publishedAt, likelyShort: v.likelyShort, views: v.views, likes: v.likes, comments: v.comments };
    p.engagementRate = engagementRate(p);
    return p;
  });

  const totals = { views: 0, likes: 0, comments: 0 };
  const byDay = new Map();
  for (const p of posts) {
    totals.views += p.views || 0;
    totals.likes += p.likes || 0;
    totals.comments += p.comments || 0;
    byDay.set(dayKey(p.publishedAt), (byDay.get(dayKey(p.publishedAt)) ?? 0) + (p.views || 0));
  }
  totals.interactions = totals.likes + totals.comments;
  totals.shorts = posts.filter((p) => p.likelyShort).length;
  const series = [];
  for (let t = since.getTime() + DAY; t <= until.getTime(); t += DAY) series.push({ date: dayKey(t), views: byDay.get(dayKey(t)) ?? 0 });

  return {
    platform: 'youtube',
    account: {
      username: account.username,
      displayName: channel.snippet?.title || account.displayName,
      avatarUrl: channel.snippet?.thumbnails?.default?.url || account.avatarUrl,
      followers: channel.statistics?.hiddenSubscriberCount ? null : Number(channel.statistics?.subscriberCount ?? 0),
      mediaCount: Number(channel.statistics?.videoCount ?? 0),
    },
    range: { days, since, until },
    totals,
    series,
    posts: posts.sort((a, b) => (b.views || 0) - (a.views || 0)),
    notes: ['Totals cover videos published in this period, with their lifetime views. Public YouTube data doesn’t include reach.'],
  };
}

module.exports = { instagramInsights, youtubeInsights, windows, engagementRate };
