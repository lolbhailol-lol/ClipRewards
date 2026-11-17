const { Router } = require('express');
const { z } = require('zod');
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const Brand = require('../models/Brand');
const Participation = require('../models/Participation');
const Submission = require('../models/Submission');
const Earning = require('../models/Earning');
const Withdrawal = require('../models/Withdrawal');
const tracking = require('../lib/tracking');
const youtube = require('../lib/youtube');
const instagram = require('../lib/instagram');
const { requireAuth, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = Router();
router.use(requireAuth, requireRole('creator'));

const DAY = 86400000;

/** Submit a clip to a campaign. Checks the post is on the creator's own connected account. */
router.post(
  '/',
  validate(z.object({ campaignId: z.string().refine(mongoose.isValidObjectId, 'Unknown campaign'), url: z.string().trim().url('Paste the full link to your post') })),
  async (req, res) => {
    if (!req.user.onboarded) return res.status(403).json({ error: 'Finish setting up your profile first' });
    const campaign = await Campaign.findById(req.body.campaignId);
    const now = new Date();
    if (!campaign || campaign.status !== 'live' || campaign.startsAt > now || campaign.endsAt <= now) {
      return res.status(400).json({ error: 'This campaign isn’t accepting clips right now' });
    }
    if (campaign.spentPaise >= campaign.budgetPaise) return res.status(400).json({ error: 'This campaign’s budget is used up' });
    const brand = await Brand.findById(campaign.brandId, 'approvalStatus');
    if (brand?.approvalStatus !== 'approved') return res.status(400).json({ error: 'This campaign isn’t accepting clips right now' });

    // Wrong platform for this campaign? Say so before asking them to connect anything.
    const linkPlatform = youtube.parseVideoId(req.body.url) ? 'youtube' : instagram.parseShortcode(req.body.url) ? 'instagram' : null;
    const allowed = campaign.platforms.map((p) => (p === 'instagram' ? 'Instagram Reels' : 'YouTube Shorts')).join(' or ');
    if (linkPlatform && !campaign.platforms.includes(linkPlatform)) return res.status(400).json({ error: `This campaign only accepts ${allowed}` });

    let found;
    try {
      found = await tracking.resolveOwnPost(req.user._id, req.body.url);
    } catch (err) {
      if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
      console.warn('[submissions] lookup failed:', err.status || '', err.message);
      return res.status(502).json({ error: 'Couldn’t reach the platform to check your post. Try again in a minute.' });
    }

    if (!campaign.platforms.includes(found.platform)) {
      return res.status(400).json({ error: `This campaign only accepts ${campaign.platforms.map((p) => (p === 'instagram' ? 'Instagram Reels' : 'YouTube Shorts')).join(' or ')}` });
    }
    if (found.platform === 'youtube' && found.post.likelyShort === false) return res.status(400).json({ error: 'Submit a YouTube Short (3 minutes or less)' });
    if (found.post.publishedAt && found.post.publishedAt < new Date(campaign.startsAt.getTime() - DAY)) {
      return res.status(400).json({ error: 'This post was published before the campaign started. Post a new clip for this campaign.' });
    }

    // Joining happens automatically when a creator submits.
    await Participation.updateOne({ campaignId: campaign._id, creatorId: req.user._id }, { $setOnInsert: { campaignId: campaign._id, creatorId: req.user._id } }, { upsert: true });

    try {
      const sub = await Submission.create({
        campaignId: campaign._id,
        creatorId: req.user._id,
        socialAccountId: found.account._id,
        platform: found.platform,
        postId: found.post.id,
        mediaType: found.post.mediaType,
        url: found.post.url || req.body.url,
        title: found.post.title,
        thumbnailUrl: found.post.thumbnailUrl,
        publishedAt: found.post.publishedAt,
        views: found.stats.views || 0,
        likes: found.stats.likes,
        comments: found.stats.comments,
        shares: found.stats.shares,
        lastCheckedAt: now,
      });
      res.status(201).json({ submission: sub.toPublic(campaign) });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'This post has already been submitted' });
      throw err;
    }
  }
);

router.get('/mine', async (req, res) => {
  const filter = { creatorId: req.user._id };
  if (mongoose.isValidObjectId(req.query.campaignId)) filter.campaignId = req.query.campaignId;
  const subs = await Submission.find(filter).sort({ createdAt: -1 }).limit(200);
  const campaigns = new Map((await Campaign.find({ _id: { $in: subs.map((s) => s.campaignId) } }, 'title ratePer1kPaise')).map((c) => [c._id.toString(), c]));
  res.json({ submissions: subs.map((s) => s.toPublic(campaigns.get(s.campaignId.toString()))) });
});

router.get('/wallet', async (req, res) => {
  const [wallet, earnings, withdrawals] = await Promise.all([
    tracking.walletFor(req.user._id),
    Earning.find({ creatorId: req.user._id }).sort({ createdAt: -1 }).limit(30).lean(),
    Withdrawal.find({ creatorId: req.user._id }).sort({ createdAt: -1 }).limit(30),
  ]);
  const titles = new Map((await Campaign.find({ _id: { $in: earnings.map((e) => e.campaignId) } }, 'title')).map((c) => [c._id.toString(), c.title]));
  const now = Date.now();
  const activity = [
    ...earnings.map((e) => ({
      id: e._id.toString(),
      kind: e.amountPaise >= 0 ? 'earning' : 'reversal',
      amountPaise: e.amountPaise,
      title: titles.get(e.campaignId.toString()) || 'Campaign',
      detail: e.amountPaise >= 0 ? `${e.views.toLocaleString('en-IN')} views` : e.note,
      onHold: new Date(e.availableAt).getTime() > now,
      availableAt: e.availableAt,
      at: e.createdAt,
    })),
    ...withdrawals.map((w) => ({ id: w._id.toString(), kind: 'withdrawal', amountPaise: -w.amountPaise, title: `Withdrawal to ${w.upiId}`, detail: w.status === 'paid' ? `Paid${w.reference ? ` · ref ${w.reference}` : ''}` : w.status === 'rejected' ? `Not paid: ${w.note}` : 'Processing', status: w.status, at: w.createdAt })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  res.json({ wallet, activity });
});

/** Withdraw everything that's withdrawable to the creator's UPI ID. */
router.post('/wallet/withdraw', async (req, res) => {
  const upiId = req.user.creator?.upiId;
  if (!upiId) return res.status(400).json({ error: 'Add your UPI ID first', code: 'no_upi' });
  if (await Withdrawal.exists({ creatorId: req.user._id, status: 'requested' })) {
    return res.status(409).json({ error: 'You already have a withdrawal being processed' });
  }
  const wallet = await tracking.walletFor(req.user._id);
  if (wallet.withdrawablePaise < tracking.MIN_WITHDRAW_PAISE) {
    return res.status(400).json({ error: `You can withdraw once you have ₹${tracking.MIN_WITHDRAW_PAISE / 100} or more` });
  }
  const w = await Withdrawal.create({ creatorId: req.user._id, amountPaise: wallet.withdrawablePaise, upiId });
  res.status(201).json({ withdrawal: w.toPublic(), wallet: await tracking.walletFor(req.user._id) });
});

module.exports = router;
