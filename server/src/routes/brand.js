const { Router } = require('express');
const mongoose = require('mongoose');
const Brand = require('../models/Brand');
const Campaign = require('../models/Campaign');
const Participation = require('../models/Participation');
const Submission = require('../models/Submission');
const SocialAccount = require('../models/SocialAccount');
const { requireAuth, requireRole } = require('../middleware/auth');

/**
 * What a signed-in brand sees: its campaigns with results, and the clips posted for them.
 * Read-only: campaigns are set up and clips are reviewed by the CreatorPerks team.
 */
const router = Router();
router.use(requireAuth, requireRole('brand'));

async function myBrand(req) {
  if (req.user.brandId) return Brand.findById(req.user.brandId);
  return Brand.findOne({ ownerId: req.user._id });
}

/** Campaigns (every status except deleted drafts) with per-campaign and total results. */
router.get('/summary', async (req, res) => {
  const brand = await myBrand(req);
  if (!brand) return res.json({ campaigns: [], totals: { views: 0, spentPaise: 0, clips: 0, approvedClips: 0, creators: 0, live: 0 } });

  const campaigns = await Campaign.find({ brandId: brand._id, status: { $ne: 'draft' } }).sort({ createdAt: -1 });
  const ids = campaigns.map((c) => c._id);
  const [joins, clipStats] = await Promise.all([
    Participation.aggregate([{ $match: { campaignId: { $in: ids } } }, { $group: { _id: '$campaignId', n: { $sum: 1 } } }]),
    Submission.aggregate([
      { $match: { campaignId: { $in: ids }, status: { $in: ['pending', 'approved'] } } },
      {
        $group: {
          _id: '$campaignId',
          clips: { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          // Only approved clips count toward results the brand pays for.
          views: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$views', 0] } },
        },
      },
    ]),
  ]);
  const joined = new Map(joins.map((j) => [String(j._id), j.n]));
  const stats = new Map(clipStats.map((s) => [String(s._id), s]));

  const list = campaigns.map((c) => {
    const s = stats.get(String(c._id)) || {};
    return { ...c.toPublic(brand), spentPaise: c.spentPaise, creators: joined.get(String(c._id)) || 0, clips: s.clips || 0, approvedClips: s.approved || 0, views: s.views || 0 };
  });
  const totals = list.reduce(
    (t, c) => ({
      views: t.views + c.views,
      spentPaise: t.spentPaise + (c.spentPaise || 0),
      clips: t.clips + c.clips,
      approvedClips: t.approvedClips + c.approvedClips,
      creators: t.creators + c.creators,
      live: t.live + (c.status === 'live' ? 1 : 0),
    }),
    { views: 0, spentPaise: 0, clips: 0, approvedClips: 0, creators: 0, live: 0 }
  );
  res.json({ campaigns: list, totals });
});

/** Clips posted for this brand's campaigns (newest first). */
router.get('/clips', async (req, res) => {
  const brand = await myBrand(req);
  if (!brand) return res.json({ clips: [] });
  const filter = { brandId: brand._id };
  if (mongoose.isValidObjectId(req.query.campaignId)) filter._id = req.query.campaignId;
  const campaigns = await Campaign.find(filter, 'title').lean();
  const titles = new Map(campaigns.map((c) => [String(c._id), c.title]));
  const subs = await Submission.find({ campaignId: { $in: campaigns.map((c) => c._id) }, status: { $in: ['pending', 'approved'] } })
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();
  const handles = new Map(
    (await SocialAccount.find({ _id: { $in: subs.map((s) => s.socialAccountId) } }, 'username displayName').lean()).map((a) => [String(a._id), a.username || a.displayName || ''])
  );
  res.json({
    clips: subs.map((s) => ({
      id: String(s._id),
      campaign: { id: String(s.campaignId), title: titles.get(String(s.campaignId)) || '' },
      creator: handles.get(String(s.socialAccountId)) || '',
      platform: s.platform,
      url: s.url,
      title: s.title,
      thumbnailUrl: s.thumbnailUrl,
      status: s.status,
      views: s.views,
      likes: s.likes,
      comments: s.comments,
      publishedAt: s.publishedAt,
      lastCheckedAt: s.lastCheckedAt,
      createdAt: s.createdAt,
    })),
  });
});

module.exports = router;
