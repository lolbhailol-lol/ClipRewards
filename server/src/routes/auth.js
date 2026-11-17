const { Router } = require('express');
const { z } = require('zod');
const config = require('../config');
const User = require('../models/User');
const Brand = require('../models/Brand');
const { issueOtp, verifyOtp } = require('../lib/otp');
const firebase = require('../lib/firebase');
const { signToken, requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = Router();
const email = z.string().trim().toLowerCase().email('Enter a valid email');

/** Promote ADMIN_EMAILS, save, and send the session payload. */
async function finishSignIn(user, res) {
  if (config.adminEmails.includes(user.email) && user.role !== 'admin') {
    user.role = 'admin';
    user.onboarded = true;
  }
  await user.save();
  const brand = user.brandId ? await Brand.findById(user.brandId).lean() : null;
  res.json({ token: signToken(user), user: user.toPublic(), brand });
}

/** Tells the client which sign-in methods are on. */
router.get('/config', (req, res) => {
  res.json({
    google: Boolean(config.firebaseProjectId),
    devEmail: config.exposeDevOtp,
    instagram: Boolean(config.instagram.appId && config.instagram.appSecret),
    youtube: Boolean(config.youtubeApiKey),
  });
});

/**
 * Google sign-in via Firebase. This is the only sign-in in production.
 * There is no separate sign-up: the account is created on first sign-in.
 */
router.post('/firebase', validate(z.object({ idToken: z.string().min(20) })), async (req, res) => {
  let claims;
  try {
    claims = await firebase.verifyFirebaseToken(req.body.idToken);
  } catch (err) {
    if (err.status === 503) return res.status(503).json({ error: err.message });
    console.warn('[auth] Google sign-in rejected:', err.code || '', err.message);
    return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
  }
  if (claims.firebase?.sign_in_provider !== 'google.com') {
    return res.status(400).json({ error: 'Please continue with Google' });
  }
  if (!claims.email || !claims.email_verified) {
    return res.status(400).json({ error: 'Your Google account needs a verified email' });
  }

  const userEmail = claims.email.toLowerCase();
  let user = (await User.findOne({ firebaseUid: claims.uid })) || (await User.findOne({ email: userEmail }));
  if (!user) user = new User({ email: userEmail });
  user.firebaseUid = claims.uid;
  if (!user.name && claims.name) user.name = claims.name;
  if (claims.picture) user.avatarUrl = claims.picture;
  await finishSignIn(user, res);
});

/* ---------- Dev-only email code sign-in (demo accounts). Off in production. ---------- */

router.use('/otp', (req, res, next) => (config.exposeDevOtp ? next() : res.status(404).json({ error: 'Not found' })));

router.post('/otp/request', validate(z.object({ email })), async (req, res) => {
  const code = await issueOtp(req.body.email);
  console.log(`[auth] dev OTP for ${req.body.email}: ${code}`);
  res.json({ sent: true, devCode: code });
});

router.post(
  '/otp/verify',
  validate(z.object({ email, code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') })),
  async (req, res) => {
    const ok = await verifyOtp(req.body.email, req.body.code);
    if (!ok) return res.status(400).json({ error: 'That code is wrong or expired' });
    const user = (await User.findOne({ email: req.body.email })) || new User({ email: req.body.email });
    await finishSignIn(user, res);
  }
);

router.get('/me', requireAuth, async (req, res) => {
  const brand = req.user.brandId ? await Brand.findById(req.user.brandId).lean() : null;
  res.json({ user: req.user.toPublic(), brand });
});

module.exports = router;
