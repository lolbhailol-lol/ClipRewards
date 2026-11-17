const config = require('../config');
const { fetchJson, ApiError } = require('./http');

const API = 'https://www.googleapis.com/youtube/v3';

/** Video ID from a Shorts / watch / youtu.be / embed link, or null. */
function parseVideoId(input) {
  let url;
  try {
    url = new URL(String(input).trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'music.youtube.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') id = url.searchParams.get('v');
    else if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) id = parts[1];
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** ISO 8601 duration (PT1M5S) → seconds. */
function durationSeconds(iso = '') {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const [d, h, min, s] = m.slice(1).map((x) => Number(x || 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

/**
 * The channel that owns a Google OAuth access token (scope youtube.readonly).
 * Used once to prove a creator owns the channel; the token is not stored.
 */
async function getMyChannel(accessToken) {
  const data = await fetchJson(`${API}/channels?part=snippet,statistics&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const ch = data.items?.[0];
  if (!ch) throw new ApiError('This Google account has no YouTube channel', 404);
  return {
    id: ch.id,
    title: ch.snippet?.title || '',
    handle: (ch.snippet?.customUrl || '').replace(/^@/, ''),
    avatarUrl: ch.snippet?.thumbnails?.default?.url || '',
    subscribers: ch.statistics?.hiddenSubscriberCount ? null : Number(ch.statistics?.subscriberCount ?? 0),
    videoCount: Number(ch.statistics?.videoCount ?? 0),
  };
}

/** Public stats for up to 50 videos, using the server API key (no user token needed). */
async function getVideos(ids) {
  if (!config.youtubeApiKey) throw new ApiError('YouTube tracking isn’t set up on the server yet', 503);
  if (!ids.length) return [];
  const qs = new URLSearchParams({ part: 'snippet,statistics,contentDetails', id: ids.slice(0, 50).join(','), key: config.youtubeApiKey });
  const data = await fetchJson(`${API}/videos?${qs}`);
  return (data.items || []).map((v) => {
    const seconds = durationSeconds(v.contentDetails?.duration);
    return {
      id: v.id,
      channelId: v.snippet?.channelId,
      title: v.snippet?.title || '',
      publishedAt: v.snippet?.publishedAt,
      thumbnailUrl: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || '',
      durationSeconds: seconds,
      // YouTube doesn't expose a "is Short" flag; Shorts are vertical and up to 3 minutes.
      likelyShort: seconds > 0 && seconds <= 180,
      views: Number(v.statistics?.viewCount ?? 0),
      likes: v.statistics?.likeCount != null ? Number(v.statistics.likeCount) : null,
      comments: v.statistics?.commentCount != null ? Number(v.statistics.commentCount) : null,
    };
  });
}

module.exports = { parseVideoId, durationSeconds, getMyChannel, getVideos };
