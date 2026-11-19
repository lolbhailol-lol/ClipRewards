const { Router } = require('express');
const { z } = require('zod');
const mongoose = require('mongoose');
const Brand = require('../models/Brand');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = Router();
router.use(requireAuth, requireRole('admin'));
router.use(require('./adminCampaigns'));
router.use(require('./adminClips'));

const validId = (req, res, next) =>
  mongoose.isValidObjectId(req.params.id) ? next() : res.status(404).json({ error: 'Not found' });

router.get('/stats', async (req, res) => {
  const Campaign = require('../models/Campaign');
  const [pendingBrands, newLeads, creators, brands, liveCampaigns] = await Promise.all([
    Brand.countDocuments({ approvalStatus: 'pending' }),
    Lead.countDocuments({ status: 'new' }),
    User.countDocuments({ role: 'creator', onboarded: true }),
    Brand.countDocuments({ approvalStatus: 'approved' }),
    Campaign.countDocuments({ status: 'live' }),
  ]);
  res.json({ pendingBrands, newLeads, creators, brands, liveCampaigns });
});

router.get('/brands', async (req, res) => {
  const status = Brand.APPROVAL.includes(req.query.status) ? req.query.status : undefined;
  const brands = await Brand.find(status ? { approvalStatus: status } : {})
    .sort({ createdAt: -1 })
    .populate('ownerId', 'email')
    .lean();
  res.json({ brands });
});

const ACTIONS = { approve: 'approved', reject: 'rejected', request_info: 'info_requested' };

router.patch(
  '/brands/:id',
  validId,
  validate(
    z
      .object({ action: z.enum(['approve', 'reject', 'request_info']), note: z.string().trim().max(500).optional().default('') })
      .refine((v) => v.action === 'approve' || v.note, { message: 'Add a note so the brand knows what to fix' })
  ),
  async (req, res) => {
    const brand = await Brand.findByIdAndUpdate(
      req.params.id,
      { approvalStatus: ACTIONS[req.body.action], adminNote: req.body.note, reviewedAt: new Date() },
      { new: true }
    );
    if (!brand) return res.status(404).json({ error: 'Not found' });
    res.json({ brand });
  }
);

router.get('/leads', async (req, res) => {
  const status = Lead.LEAD_STATUS.includes(req.query.status) ? req.query.status : undefined;
  const leads = await Lead.find(status ? { status } : {}).sort({ createdAt: -1 }).lean();
  res.json({ leads });
});

router.patch(
  '/leads/:id',
  validId,
  validate(z.object({ status: z.enum(Lead.LEAD_STATUS) })),
  async (req, res) => {
    const lead = await Lead.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!lead) return res.status(404).json({ error: 'Not found' });
    res.json({ lead });
  }
);

module.exports = router;
