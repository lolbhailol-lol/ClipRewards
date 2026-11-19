const crypto = require('crypto');
const { Router } = require('express');
const express = require('express');
const config = require('../config');
const SocialAccount = require('../models/SocialAccount');
const InsightsCache = require('../models/InsightsCache');
const User = require('../models/User');
const DeletionRequest = require('../models/DeletionRequest');

/**
 * Meta callbacks (Meta app → Instagram → Business login settings):
 * - Deauthorize callback URL:      https://<domain>/api/social/instagram/deauthorize
 * - Data deletion request URL:     https://<domain>/api/social/instagram/data-deletion
 * Both receive a `signed_request` (form field) signed with the Instagram app secret.
 * We delete the connected Instagram account, its token and cached insights.
 */
const router = Router();
const form = express.urlencoded({ extended: false, limit: '20kb' });

const b64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/** Verifies and decodes Meta's signed_request. Returns the payload, or null if invalid. */
function parseSignedRequest(signedRequest) {
  const secret = config.instagram.appSecret;
  if (!secret || typeof signedRequest !== 'string' || !signedRequest.includes('.')) return null;
  const [sigPart, payloadPart] = signedRequest.split('.', 2);
  const sig = b64url(sigPart);
  const expected = crypto.createHmac('sha256', secret).update(payloadPart).digest();
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(b64url(payloadPart).toString('utf8'));
    if (payload.algorithm && String(payload.algorithm).toUpperCase() !== 'HMAC-SHA256') return null;
    return payload;
  } catch {
    return null;
  }
}

/** Deletes every stored Instagram connection for this Instagram user id. */
async function deleteInstagramData(igUserId) {
  const accounts = await SocialAccount.find({ platform: 'instagram', externalId: String(igUserId) });
  for (const acc of accounts) {
    await InsightsCache.deleteMany({ accountId: acc._id });
    await SocialAccount.deleteOne({ _id: acc._id });
    await User.updateOne({ _id: acc.userId }, { $set: { 'creator.instagram': '', 'creator.igAccess.status': '' } });
  }
  return accounts.length;
}

const signedUserId = (req) => {
  const payload = parseSignedRequest(req.body?.signed_request);
  return payload?.user_id != null ? String(payload.user_id) : null;
};

router.post('/api/social/instagram/deauthorize', form, async (req, res) => {
  const userId = signedUserId(req);
  if (!userId) return res.sendStatus(400);
  await deleteInstagramData(userId);
  res.sendStatus(200);
});

router.post('/api/social/instagram/data-deletion', form, async (req, res) => {
  const userId = signedUserId(req);
  if (!userId) return res.status(400).json({ error: 'Invalid signed_request' });
  await deleteInstagramData(userId);
  const code = crypto.randomBytes(8).toString('hex');
  await DeletionRequest.create({ code, platform: 'instagram', externalId: userId });
  res.json({ url: `${config.clientOrigin}/data-deletion?code=${code}`, confirmation_code: code });
});

/** Public status check for the confirmation code Meta shows the person. */
router.get('/api/data-deletion/:code', async (req, res) => {
  if (!/^[a-f0-9]{16}$/.test(req.params.code)) return res.status(404).json({ error: 'Not found' });
  const r = await DeletionRequest.findOne({ code: req.params.code }).lean();
  if (!r) return res.status(404).json({ error: 'We couldn’t find that confirmation code' });
  res.json({ status: r.status, platform: r.platform, requestedAt: r.createdAt });
});

module.exports = { router, parseSignedRequest };
