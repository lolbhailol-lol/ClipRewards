const Campaign = require('../models/Campaign');
const Submission = require('../models/Submission');
const SocialAccount = require('../models/SocialAccount');
const Earning = require('../models/Earning');
const Withdrawal = require('../models/Withdrawal');
const instagram = require('./instagram');
const youtube = require('./youtube');
const { decrypt } = require('./crypto');
const { ApiError } = require('./http');

const DAY = 86400000;
const HOLD_DAYS = 7;
const TRACK_DAYS_AFTER_END = 7; // keep counting views a week after a campaign ends
const MIN_WITHDRAW_PAISE = 20000;

/* ---------------- Finding a creator's own post ---------------- */

/**
 * Resolves a Reel / Short link to a post on the creator's connected account.
 * Throws ApiError(400/403/404) with a message the creator can act on.
 */
async function resolveOwnPost(userId, url) {
  const videoId = youtube.parseVideoId(url);
  if (videoId) {
    const account = await SocialAccount.findOne({ userId, platform: 'youtube' });
    if (!account) throw new ApiError('Connect your YouTube channel first', 400);
    const [v] = await youtube.getVideos([videoId]);
    if (!v) throw new ApiError('Video not found or not public', 404);
    if (v.channelId !== account.externalId) throw new ApiError('This video isn’t on your connected YouTube channel', 403);
    return {
      platform: 'youtube',
      account,
      post: { id: v.id, mediaType: v.likelyShort ? 'SHORT' : 'VIDEO', url: `https://youtube.com/shorts/${v.id}`, title: v.title, thumbnailUrl: v.thumbnailUrl, publishedAt: v.publishedAt ? new Date(v.publishedAt) : null, likelyShort: v.likelyShort },
      stats: { views: v.views, likes: v.likes, comments: v.comments, shares: null },
    };
  }
  if (instagram.parseShortcode(url)) {
    const account = await SocialAccount.findOne({ userId, platform: 'instagram' }).select('+accessTokenEnc');
    if (!account) throw new ApiError('Connect your Instagram account first', 400);
    if (account.status === 'expired') throw new ApiError('Your Instagram connection expired. Reconnect it in Profile.', 400);
    const token = decrypt(account.accessTokenEnc);
    const media = await instagram.findOwnMedia(token, account.externalId, url);
    if (!media) throw new ApiError('This post isn’t on your connected Instagram account', 403);
    const stats = await instagram.getInsights(token, media).catch(() => ({ likes: media.like_count ?? null, comments: media.comments_count ?? null }));
    return {
      platform: 'instagram',
      account,
      post: { id: media.id, mediaType: media.media_type, url: media.permalink, title: (media.caption || '').split('\n')[0].slice(0, 120), thumbnailUrl: media.thumbnail_url || '', publishedAt: media.timestamp ? new Date(media.timestamp) : null },
      stats: { views: stats.views ?? 0, likes: stats.likes ?? null, comments: stats.comments ?? null, shares: stats.shares ?? null },
    };
  }
  throw new ApiError('Paste an Instagram Reel link or a YouTube Shorts link', 400);
}

/* ---------------- Money ---------------- */

/** What a clip has earned in total at `views`, capped per clip. */
function earnedFor(views, ratePer1kPaise, perClipCapPaise) {
  const raw = Math.floor(((views || 0) * ratePer1kPaise) / 1000);
  return perClipCapPaise > 0 ? Math.min(raw, perClipCapPaise) : raw;
}

/** Very simple bot signal: lots of views with almost no likes/comments. */
function fraudCheck(sub) {
  if (sub.views < 5000 || sub.likes == null) return null;
  const eng = (sub.likes || 0) + (sub.comments || 0);
  if (eng / sub.views < 0.002) return `Very low engagement for ${sub.views} views (${eng} likes + comments)`;
  return null;
}

/**
 * Credits any new earnings for an approved clip. The campaign budget is reserved
 * atomically, so two clips can never overspend it.
 */
async function accrue(sub, campaign, now = new Date()) {
  if (sub.status !== 'approved' || sub.flagged) return 0;
  const target = earnedFor(sub.views, campaign.ratePer1kPaise, campaign.perClipCapPaise);
  let delta = target - sub.earnedPaise;
  if (delta <= 0) return 0;

  for (let attempt = 0; attempt < 3 && delta > 0; attempt++) {
    const fresh = await Campaign.findById(campaign._id, 'budgetPaise spentPaise');
    const grant = Math.min(delta, fresh.budgetPaise - fresh.spentPaise);
    if (grant <= 0) return 0;
    const ok = await Campaign.updateOne({ _id: campaign._id, spentPaise: fresh.spentPaise }, { $inc: { spentPaise: grant } });
    if (ok.modifiedCount === 1) {
      sub.earnedPaise += grant;
      await sub.save();
      await Earning.create({
        creatorId: sub.creatorId,
        submissionId: sub._id,
        campaignId: campaign._id,
        amountPaise: grant,
        views: sub.views,
        availableAt: new Date(now.getTime() + HOLD_DAYS * DAY),
      });
      return grant;
    }
    // Someone else changed spentPaise in between; retry with fresh numbers.
  }
  return 0;
}

/* ---------------- Re-reading views ---------------- */

/** Refreshes stats for the given submissions (or everything still being tracked) and credits earnings. */
async function syncSubmissions({ ids, now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - TRACK_DAYS_AFTER_END * DAY);
  const query = ids ? { _id: { $in: ids } } : { status: { $in: ['pending', 'approved'] } };
  const subs = await Submission.find(query);
  const campaigns = new Map((await Campaign.find({ _id: { $in: [...new Set(subs.map((s) => s.campaignId.toString()))] } })).map((c) => [c._id.toString(), c]));
  const tracked = subs.filter((s) => {
    const c = campaigns.get(s.campaignId.toString());
    return c && c.endsAt > cutoff;
  });

  const result = { checked: 0, credited: 0, errors: 0, flagged: 0 };

  // YouTube: one batched call per 50 videos, public stats with the API key.
  const yt = tracked.filter((s) => s.platform === 'youtube');
  for (let i = 0; i < yt.length; i += 50) {
    const batch = yt.slice(i, i + 50);
    try {
      const videos = new Map((await youtube.getVideos(batch.map((s) => s.postId))).map((v) => [v.id, v]));
      for (const s of batch) {
        const v = videos.get(s.postId);
        if (!v) {
          s.status = s.status === 'approved' ? 'removed' : s.status;
          s.checkError = 'Video is no longer public';
        } else Object.assign(s, { views: v.views, likes: v.likes, comments: v.comments, checkError: '' });
        s.lastCheckedAt = now;
      }
    } catch (err) {
      batch.forEach((s) => (s.checkError = err.message));
      result.errors += batch.length;
    }
  }

  // Instagram: per post, with the creator's own token.
  const ig = tracked.filter((s) => s.platform === 'instagram');
  const accounts = new Map(
    (await SocialAccount.find({ _id: { $in: ig.map((s) => s.socialAccountId) } }).select('+accessTokenEnc')).map((a) => [a._id.toString(), a])
  );
  for (const s of ig) {
    const acc = accounts.get(s.socialAccountId.toString());
    if (!acc || acc.status === 'expired') {
      s.checkError = 'Instagram connection expired';
      result.errors++;
      continue;
    }
    try {
      const stats = await instagram.getInsights(decrypt(acc.accessTokenEnc), { id: s.postId, media_type: s.mediaType });
      Object.assign(s, { views: stats.views ?? s.views, likes: stats.likes, comments: stats.comments, shares: stats.shares, checkError: '', lastCheckedAt: now });
    } catch (err) {
      s.checkError = err.status === 400 ? 'Post deleted or not accessible' : err.message;
      if (err.status === 400 && s.status === 'approved') s.status = 'removed';
      result.errors++;
    }
  }

  for (const s of tracked) {
    result.checked++;
    const reason = !s.flagged && fraudCheck(s);
    if (reason) {
      s.flagged = true;
      s.flagReason = reason;
      result.flagged++;
    }
    await s.save();
    result.credited += await accrue(s, campaigns.get(s.campaignId.toString()), now);
  }
  return result;
}

/* ---------------- Wallet ---------------- */

async function walletFor(creatorId, now = new Date()) {
  const [earn] = await Earning.aggregate([
    { $match: { creatorId } },
    {
      $group: {
        _id: null,
        total: { $sum: '$amountPaise' },
        available: { $sum: { $cond: [{ $lte: ['$availableAt', now] }, '$amountPaise', 0] } },
      },
    },
  ]);
  const [out] = await Withdrawal.aggregate([
    { $match: { creatorId, status: { $in: ['requested', 'paid'] } } },
    { $group: { _id: null, reserved: { $sum: '$amountPaise' }, paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amountPaise', 0] } } } },
  ]);
  const total = earn?.total ?? 0;
  const available = earn?.available ?? 0;
  const reserved = out?.reserved ?? 0;
  return {
    totalEarnedPaise: total,
    onHoldPaise: total - available,
    withdrawablePaise: Math.max(0, available - reserved),
    paidOutPaise: out?.paid ?? 0,
    pendingWithdrawalPaise: reserved - (out?.paid ?? 0),
    minWithdrawPaise: MIN_WITHDRAW_PAISE,
  };
}

module.exports = { resolveOwnPost, earnedFor, fraudCheck, accrue, syncSubmissions, walletFor, HOLD_DAYS, MIN_WITHDRAW_PAISE };
