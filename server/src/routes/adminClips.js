const { Router } = require('express');
const { z } = require('zod');
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const Submission = require('../models/Submission');
const Earning = require('../models/Earning');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const tracking = require('../lib/tracking');
const validate = require('../middleware/validate');

// Mounted under /api/admin (already admin-only): clip review + payouts.
const router = Router();
const validId = (req, res, next) => (mongoose.isValidObjectId(req.params.id) ? next() : res.status(404).json({ error: 'Not found' }));

router.get('/submissions', async (req, res) => {
  const q = {};
  if (req.query.status === 'flagged') q.flagged = true;
  else if (Submission.SUB_STATUS.includes(req.query.status)) q.status = req.query.status;
  const subs = await Submission.find(q).sort({ createdAt: -1 }).limit(200);
  const [campaigns, creators] = await Promise.all([
    Campaign.find({ _id: { $in: subs.map((s) => s.campaignId) } }, 'title ratePer1kPaise'),
    User.find({ _id: { $in: subs.map((s) => s.creatorId) } }, 'name email'),
  ]);
  const cBy = new Map(campaigns.map((c) => [c._id.toString(), c]));
  const uBy = new Map(creators.map((u) => [u._id.toString(), u]));
  const counts = Object.fromEntries((await Submission.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])).map((x) => [x._id, x.n]));
  counts.flagged = await Submission.countDocuments({ flagged: true });
  res.json({
    submissions: subs.map((s) => {
      const u = uBy.get(s.creatorId.toString());
      return { ...s.toPublic(cBy.get(s.campaignId.toString())), creator: u ? { name: u.name, email: u.email } : null, flagReason: s.flagReason, checkError: s.checkError };
    }),
    counts,
  });
});

router.patch(
  '/submissions/:id',
  validId,
  validate(
    z
      .object({ action: z.enum(['approve', 'reject', 'clear_flag']), note: z.string().trim().max(300).optional().default('') })
      .refine((v) => v.action !== 'reject' || v.note, { message: 'Tell the creator why it was rejected', path: ['note'] })
  ),
  async (req, res) => {
    const sub = await Submission.findById(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Not found' });
    const campaign = await Campaign.findById(sub.campaignId);
    const { action, note } = req.body;

    if (action === 'approve') {
      sub.status = 'approved';
      sub.reviewNote = note;
      sub.reviewedAt = new Date();
      await sub.save();
      await tracking.accrue(sub, campaign);
    } else if (action === 'clear_flag') {
      sub.flagged = false;
      sub.flagReason = '';
      await sub.save();
      await tracking.accrue(sub, campaign);
    } else {
      // Reject: reverse anything it earned and return it to the campaign budget.
      if (sub.earnedPaise > 0) {
        await Earning.create({ creatorId: sub.creatorId, submissionId: sub._id, campaignId: sub.campaignId, amountPaise: -sub.earnedPaise, views: sub.views, availableAt: new Date(), note: `Clip rejected: ${note}` });
        await Campaign.updateOne({ _id: sub.campaignId }, { $inc: { spentPaise: -sub.earnedPaise } });
        sub.earnedPaise = 0;
      }
      sub.status = 'rejected';
      sub.reviewNote = note;
      sub.reviewedAt = new Date();
      await sub.save();
    }
    res.json({ submission: sub.toPublic(campaign) });
  }
);

/** Re-read views now (normally runs every 6 hours). */
router.post('/submissions/sync', async (req, res) => {
  res.json(await tracking.syncSubmissions());
});

router.get('/withdrawals', async (req, res) => {
  const status = ['requested', 'paid', 'rejected'].includes(req.query.status) ? req.query.status : undefined;
  const ws = await Withdrawal.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(200);
  const users = new Map((await User.find({ _id: { $in: ws.map((w) => w.creatorId) } }, 'name email')).map((u) => [u._id.toString(), u]));
  const requestedTotal = (await Withdrawal.aggregate([{ $match: { status: 'requested' } }, { $group: { _id: null, t: { $sum: '$amountPaise' } } }]))[0]?.t ?? 0;
  res.json({
    withdrawals: ws.map((w) => {
      const u = users.get(w.creatorId.toString());
      return { ...w.toPublic(), creator: u ? { name: u.name, email: u.email } : null };
    }),
    requestedTotalPaise: requestedTotal,
  });
});

router.patch(
  '/withdrawals/:id',
  validId,
  validate(
    z.discriminatedUnion('action', [
      z.object({ action: z.literal('paid'), reference: z.string().trim().min(6, 'Enter the UPI transaction reference (UTR)').max(40) }),
      z.object({ action: z.literal('reject'), note: z.string().trim().min(3, 'Tell the creator why').max(300) }),
    ])
  ),
  async (req, res) => {
    const w = await Withdrawal.findById(req.params.id);
    if (!w) return res.status(404).json({ error: 'Not found' });
    if (w.status !== 'requested') return res.status(400).json({ error: `This withdrawal is already ${w.status}` });
    if (req.body.action === 'paid') {
      w.status = 'paid';
      w.reference = req.body.reference;
      w.paidAt = new Date();
    } else {
      // Rejected: the money goes back to the creator's withdrawable balance.
      w.status = 'rejected';
      w.note = req.body.note;
    }
    await w.save();
    res.json({ withdrawal: w.toPublic() });
  }
);

module.exports = router;
