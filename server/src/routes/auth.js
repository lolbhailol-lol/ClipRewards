const crypto = require('crypto');
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

const reviewLoginOn = () => {
  const { email: e, password } = config.reviewLogin;
  return Boolean(e && password.length >= 12 && !config.adminEmails.includes(e));
};
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest();
// After 20 wrong tries in 15 minutes (from anywhere), reviewer sign-in pauses until the window ends.
const reviewFails = { count: 0, since: 0 };

/** Tells the client which sign-in methods are on. */
router.get('/config', (req, res) => {
  res.json({
    google: Boolean(config.firebaseProjectId),
    devEmail: config.exposeDevOtp,
    reviewLogin: reviewLoginOn(),
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

/**
 * Reviewer sign-in (email + password from REVIEW_LOGIN_EMAIL / REVIEW_LOGIN_PASSWORD).
 * Signs in one fixed creator account so Meta/Google reviewers can test the app.
 */
router.post('/review', validate(z.object({ email, password: z.string().min(1).max(200) })), async (req, res) => {
  if (!reviewLoginOn()) return res.status(404).json({ error: 'Not found' });
  if (Date.now() - reviewFails.since > 15 * 60 * 1000) Object.assign(reviewFails, { count: 0, since: Date.now() });
  if (reviewFails.count >= 20) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const okEmail = crypto.timingSafeEqual(sha(req.body.email), sha(config.reviewLogin.email));
  const okPass = crypto.timingSafeEqual(sha(req.body.password), sha(config.reviewLogin.password));
  if (!okEmail || !okPass) {
    reviewFails.count += 1;
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  let user = await User.findOne({ email: config.reviewLogin.email });
  if (!user) user = new User({ email: config.reviewLogin.email, name: 'App Reviewer', role: 'creator', onboarded: true });
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
