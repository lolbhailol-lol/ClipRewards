const { Router } = require('express');
const { z } = require('zod');
const Lead = require('../models/Lead');
const validate = require('../middleware/validate');

const router = Router();

// Public "Book a demo / Request a pilot" form.
router.post(
  '/',
  validate(
    z.object({
      name: z.string().trim().min(2, 'Enter your name').max(80),
      company: z.string().trim().min(2, 'Enter your company').max(120),
      email: z.string().trim().toLowerCase().email('Enter a valid email'),
      phone: z.string().trim().max(20).optional().default(''),
      vertical: z.string().trim().max(30).optional().default('other'),
      budget: z.string().trim().max(30).optional().default(''),
      message: z.string().trim().max(1000).optional().default(''),
      // Honeypot: real users never fill this hidden field.
      website: z.string().max(0).optional(),
    })
  ),
  async (req, res) => {
    const { website, ...data } = req.body;
    await Lead.create(data);
    res.status(201).json({ ok: true });
  }
);

module.exports = router;
