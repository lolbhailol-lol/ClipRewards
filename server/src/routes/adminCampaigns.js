const { Router } = require('express');
const { z } = require('zod');
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const Brand = require('../models/Brand');
const User = require('../models/User');
const Participation = require('../models/Participation');
const { cloudinaryConfig, signUpload } = require('../lib/cloudinary');
const validate = require('../middleware/validate');

// Mounted under /api/admin (already admin-only).
const router = Router();

const validId = (req, res, next) => (mongoose.isValidObjectId(req.params.id) ? next() : res.status(404).json({ error: 'Not found' }));
const rupeesToPaise = (r) => Math.round(Number(r) * 100);
const httpsUrl = z.string().trim().url('Use a full https:// link').refine((u) => u.startsWith('https://'), 'Use an https:// link');
const lines = (max) => z.array(z.string().trim().min(1).max(200)).max(max);

const campaignBody = z
  .object({
    brandId: z.string().refine(mongoose.isValidObjectId, 'Pick a brand'),
    title: z.string().trim().min(4, 'Title is too short').max(100),
    brief: z.string().trim().min(10, 'Add a short brief').max(2000),
    vertical: z.enum(Brand.VERTICALS),
    type: z.enum(['clipping', 'ugc']),
    platforms: z.array(z.enum(Campaign.PLATFORMS)).min(1, 'Pick at least one platform'),
    ratePer1k: z.number({ invalid_type_error: 'Enter the rate in ₹' }).min(1, 'Rate must be at least ₹1 per 1K views').max(10000),
    budget: z.number({ invalid_type_error: 'Enter the budget in ₹' }).min(1000, 'Budget must be at least ₹1,000').max(10000000),
    perClipCap: z.number().min(0).max(10000000).optional().default(0),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date(),
    coverUrl: httpsUrl.or(z.literal('')).optional().default(''),
    gallery: z.array(httpsUrl).max(8).optional().default([]),
    assetsUrl: httpsUrl.or(z.literal('')).optional().default(''),
    deliverables: lines(12).optional().default([]),
    rules: lines(12).optional().default([]),
  })
  .refine((v) => v.endsAt > new Date(), { message: 'End date must be in the future', path: ['endsAt'] })
  .refine((v) => !v.startsAt || v.startsAt < v.endsAt, { message: 'Start must be before the end', path: ['startsAt'] });

const toDoc = (b) => ({
  brandId: b.brandId,
  title: b.title,
  brief: b.brief,
  vertical: b.vertical,
  type: b.type,
  platforms: [...new Set(b.platforms)],
  ratePer1kPaise: rupeesToPaise(b.ratePer1k),
  budgetPaise: rupeesToPaise(b.budget),
  perClipCapPaise: rupeesToPaise(b.perClipCap || 0),
  startsAt: b.startsAt || new Date(),
  endsAt: b.endsAt,
  coverUrl: b.coverUrl,
  gallery: b.gallery,
  assetsUrl: b.assetsUrl,
  deliverables: b.deliverables,
  rules: b.rules,
});

/** Admin view of a campaign: raw money fields in ₹ for the form, plus usage. */
function adminShape(c, brand, creators = 0) {
  return {
    ...c.toPublic(brand, { creators }),
    assetsUrl: c.assetsUrl,
    brandId: c.brandId.toString(),
    brandApproved: brand?.approvalStatus === 'approved',
    ratePer1k: c.ratePer1kPaise / 100,
    budget: c.budgetPaise / 100,
    spent: c.spentPaise / 100,
    perClipCap: c.perClipCapPaise / 100,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

async function brandFor(id) {
  const brand = await Brand.findById(id);
  if (!brand) {
    const err = new Error('That brand doesn’t exist');
    err.status = 400;
    throw err;
  }
  return brand;
}

router.get('/campaigns', async (req, res) => {
  const status = Campaign.STATUSES.includes(req.query.status) ? req.query.status : undefined;
  const campaigns = await Campaign.find(status ? { status } : {}).sort({ updatedAt: -1 }).limit(200);
  const brands = await Brand.find({ _id: { $in: campaigns.map((c) => c.brandId) } });
  const byId = new Map(brands.map((b) => [b._id.toString(), b]));
  const counts = await Participation.aggregate([{ $match: { campaignId: { $in: campaigns.map((c) => c._id) } } }, { $group: { _id: '$campaignId', n: { $sum: 1 } } }]);
  const countBy = new Map(counts.map((x) => [x._id.toString(), x.n]));
  const totals = await Campaign.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  res.json({
    campaigns: campaigns.map((c) => adminShape(c, byId.get(c.brandId.toString()), countBy.get(c._id.toString()) || 0)),
    counts: Object.fromEntries(totals.map((t) => [t._id, t.n])),
  });
});

router.get('/campaigns/:id', validId, async (req, res) => {
  const c = await Campaign.findById(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const [brand, creators] = await Promise.all([Brand.findById(c.brandId), Participation.countDocuments({ campaignId: c._id })]);
  res.json({ campaign: adminShape(c, brand, creators) });
});

router.post('/campaigns', validate(campaignBody.and(z.object({ status: z.enum(['draft', 'live']).default('draft') }))), async (req, res) => {
  const brand = await brandFor(req.body.brandId);
  if (req.body.status === 'live' && brand.approvalStatus !== 'approved') {
    return res.status(400).json({ error: 'Approve this brand before its campaign can go live' });
  }
  const c = await Campaign.create({ ...toDoc(req.body), status: req.body.status });
  res.status(201).json({ campaign: adminShape(c, brand) });
});

router.put('/campaigns/:id', validId, validate(campaignBody), async (req, res) => {
  const c = await Campaign.findById(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const brand = await brandFor(req.body.brandId);
  const doc = toDoc(req.body);
  if (doc.budgetPaise < c.spentPaise) return res.status(400).json({ error: `Budget can’t be below what’s already spent (₹${c.spentPaise / 100})` });
  if (c.status === 'live' && brand.approvalStatus !== 'approved') return res.status(400).json({ error: 'This brand isn’t verified' });
  c.set(doc);
  await c.save();
  res.json({ campaign: adminShape(c, brand, await Participation.countDocuments({ campaignId: c._id })) });
});

const TRANSITIONS = { draft: ['live', 'ended'], pending: ['live', 'draft', 'ended'], live: ['paused', 'ended'], paused: ['live', 'ended'], ended: [] };

router.patch('/campaigns/:id/status', validId, validate(z.object({ status: z.enum(['live', 'paused', 'ended', 'draft']) })), async (req, res) => {
  const c = await Campaign.findById(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const next = req.body.status;
  if (!TRANSITIONS[c.status]?.includes(next)) return res.status(400).json({ error: `A ${c.status} campaign can’t be set to ${next}` });
  const brand = await Brand.findById(c.brandId);
  if (next === 'live') {
    if (brand?.approvalStatus !== 'approved') return res.status(400).json({ error: 'Approve this brand before its campaign can go live' });
    if (c.endsAt <= new Date()) return res.status(400).json({ error: 'Set an end date in the future first' });
    if (c.spentPaise >= c.budgetPaise) return res.status(400).json({ error: 'The budget is used up. Raise the budget first.' });
  }
  c.status = next;
  await c.save();
  res.json({ campaign: adminShape(c, brand, await Participation.countDocuments({ campaignId: c._id })) });
});

router.delete('/campaigns/:id', validId, async (req, res) => {
  const c = await Campaign.findById(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.status !== 'draft') return res.status(400).json({ error: 'Only drafts can be deleted. End the campaign instead.' });
  await c.deleteOne();
  res.json({ ok: true });
});

/**
 * Admin creates a brand directly (for pilots run by hand). It's verified straight away.
 * If that person later signs in with Google using this email, they get this brand.
 */
router.post(
  '/brands',
  validate(
    z.object({
      company: z.string().trim().min(2, 'Enter the company name').max(120),
      contactName: z.string().trim().min(2, 'Enter a contact name').max(80),
      email: z.string().trim().toLowerCase().email('Enter the brand’s email'),
      vertical: z.enum(Brand.VERTICALS).default('other'),
      website: z.string().trim().max(200).optional().default(''),
    })
  ),
  async (req, res) => {
    const { email, ...fields } = req.body;
    let user = await User.findOne({ email });
    if (user && (user.role && user.role !== 'brand')) return res.status(409).json({ error: `That email already belongs to a ${user.role} account` });
    if (user?.brandId) return res.status(409).json({ error: 'That email already has a brand' });
    if (!user) user = new User({ email });
    user.role = 'brand';
    user.name = user.name || fields.contactName;
    user.onboarded = true;
    const brand = new Brand({ ...fields, ownerId: user._id, approvalStatus: 'approved', reviewedAt: new Date() });
    user.brandId = brand._id;
    await user.save();
    await brand.save();
    res.status(201).json({ brand });
  }
);

/** Signed params for a direct browser → Cloudinary upload. */
router.get('/uploads/signature', (req, res) => {
  const cfg = cloudinaryConfig();
  if (!cfg) return res.status(503).json({ error: 'Image upload isn’t set up. Add CLOUDINARY_URL, or paste an image link.' });
  const params = { folder: 'cliprewards/campaigns', timestamp: Math.floor(Date.now() / 1000) };
  res.json({ cloudName: cfg.cloudName, apiKey: cfg.apiKey, ...params, signature: signUpload(params, cfg.apiSecret) });
});

module.exports = router;
