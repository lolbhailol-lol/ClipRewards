const { Router } = require('express');
const { z } = require('zod');
const Brand = require('../models/Brand');
const { requireAuth, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = Router();
router.use(requireAuth);

// Users choose creator or brand once. Admin is only granted via ADMIN_EMAILS.
router.post('/role', validate(z.object({ role: z.enum(['creator', 'brand']) })), async (req, res) => {
  if (req.user.role) return res.status(409).json({ error: 'Your account type is already set' });
  req.user.role = req.body.role;
  await req.user.save();
  res.json({ user: req.user.toPublic() });
});

const optional = z.string().trim().max(200).optional().default('');

const upiId = z
  .string()
  .trim()
  .regex(/^[\w.\-]{2,}@[a-zA-Z]{2,}$/, 'Enter a valid UPI ID like name@okicici');

/**
 * Finishes creator onboarding. Everything is optional: the name comes from Google,
 * accounts are connected (not typed), and the UPI ID is asked for at the first withdrawal.
 * Also used to edit the profile later. Omitted fields are left unchanged.
 */
router.post(
  '/creator',
  requireRole('creator'),
  validate(
    z.object({
      name: z.string().trim().min(2, 'Enter your name').max(80).optional(),
      upiId: upiId.or(z.literal('')).optional(),
    })
  ),
  async (req, res) => {
    const { name, upiId: upi } = req.body;
    if (name) req.user.name = name;
    if (!req.user.name) req.user.name = req.user.email.split('@')[0];
    if (upi !== undefined) req.user.creator.upiId = upi;
    req.user.onboarded = true;
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  }
);

/** Payout details, asked for when the creator first withdraws. */
router.put('/payout', requireRole('creator'), validate(z.object({ upiId })), async (req, res) => {
  req.user.creator.upiId = req.body.upiId;
  await req.user.save();
  res.json({ user: req.user.toPublic() });
});

router.post(
  '/brand',
  requireRole('brand'),
  validate(
    z.object({
      company: z.string().trim().min(2, 'Enter your company name').max(120),
      contactName: z.string().trim().min(2, 'Enter a contact name').max(80),
      contactPhone: z.string().trim().regex(/^$|^\+?[\d\s-]{8,15}$/, 'Enter a valid phone number').optional().default(''),
      website: optional,
      gstin: z
        .string()
        .trim()
        .regex(/^$|^[0-9A-Za-z]{15}$/, 'GSTIN has 15 letters and digits')
        .optional()
        .default(''),
      vertical: z.enum(Brand.VERTICALS).default('other'),
    })
  ),
  async (req, res) => {
    const fields = req.body;
    let brand = req.user.brandId ? await Brand.findById(req.user.brandId) : null;
    if (brand) {
      // Resubmitting after "info requested" or rejection sends it back to review.
      Object.assign(brand, fields, { approvalStatus: 'pending' });
    } else {
      brand = new Brand({ ...fields, ownerId: req.user._id });
    }
    await brand.save();
    req.user.name = fields.contactName;
    req.user.brandId = brand._id;
    req.user.onboarded = true;
    await req.user.save();
    res.json({ user: req.user.toPublic(), brand });
  }
);

module.exports = router;
