const { Router } = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Campaign = require('../models/Campaign');
const Brand = require('../models/Brand');
const User = require('../models/User');
const Participation = require('../models/Participation');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

/** Attaches req.user when a valid token is sent, but never blocks. */
async function optionalAuth(req, res, next) {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) {
    try {
      const { sub } = jwt.verify(header.slice(7), config.jwtSecret);
      req.user = await User.findById(sub);
    } catch {
      /* ignore bad tokens on public routes */
    }
  }
  next();
}

// Only live campaigns from approved brands are public.
async function liveQuery(extra = {}) {
  const approved = await Brand.find({ approvalStatus: 'approved' }, '_id company').lean();
  const byId = new Map(approved.map((b) => [b._id.toString(), b]));
  const now = new Date();
  // Started, not ended, budget not used up.
  return {
    filter: {
      status: 'live',
      startsAt: { $lte: now },
      endsAt: { $gt: now },
      $expr: { $lt: ['$spentPaise', '$budgetPaise'] },
      brandId: { $in: [...byId.keys()] },
      ...extra,
    },
    byId,
  };
}

router.get('/', optionalAuth, async (req, res) => {
  const extra = Brand.VERTICALS.includes(req.query.vertical) ? { vertical: req.query.vertical } : {};
  const { filter, byId } = await liveQuery(extra);
  const campaigns = await Campaign.find(filter).sort({ createdAt: -1 }).limit(100);

  let joined = new Set();
  if (req.user?.role === 'creator') {
    const parts = await Participation.find({ creatorId: req.user._id, campaignId: { $in: campaigns.map((c) => c._id) } }, 'campaignId').lean();
    joined = new Set(parts.map((p) => p.campaignId.toString()));
  }

  res.json({
    campaigns: campaigns.map((c) => c.toPublic(byId.get(c.brandId.toString()), { joined: joined.has(c._id.toString()) })),
  });
});

router.get('/mine', requireAuth, requireRole('creator'), async (req, res) => {
  const parts = await Participation.find({ creatorId: req.user._id }).sort({ createdAt: -1 }).lean();
  const campaigns = await Campaign.find({ _id: { $in: parts.map((p) => p.campaignId) } });
  const brands = await Brand.find({ _id: { $in: campaigns.map((c) => c.brandId) } }, 'company').lean();
  const byId = new Map(brands.map((b) => [b._id.toString(), b]));
  res.json({ campaigns: campaigns.map((c) => c.toPublic(byId.get(c.brandId.toString()), { joined: true })) });
});

router.get('/:id', optionalAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Campaign not found' });
  const { filter, byId } = await liveQuery({ _id: req.params.id });
  const campaign = await Campaign.findOne(filter);
  if (!campaign) return res.status(404).json({ error: 'This campaign isn’t live anymore' });

  const [creators, joined] = await Promise.all([
    Participation.countDocuments({ campaignId: campaign._id }),
    req.user?.role === 'creator' ? Participation.exists({ campaignId: campaign._id, creatorId: req.user._id }) : null,
  ]);
  res.json({ campaign: campaign.toPublic(byId.get(campaign.brandId.toString()), { creators, joined: Boolean(joined) }) });
});

router.post('/:id/join', requireAuth, requireRole('creator'), async (req, res) => {
  if (!req.user.onboarded) return res.status(403).json({ error: 'Finish setting up your profile first' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Campaign not found' });
  const { filter } = await liveQuery({ _id: req.params.id });
  const campaign = await Campaign.findOne(filter);
  if (!campaign) return res.status(404).json({ error: 'This campaign isn’t live anymore' });

  await Participation.updateOne(
    { campaignId: campaign._id, creatorId: req.user._id },
    { $setOnInsert: { campaignId: campaign._id, creatorId: req.user._id } },
    { upsert: true }
  );
  res.json({ joined: true });
});

module.exports = router;
