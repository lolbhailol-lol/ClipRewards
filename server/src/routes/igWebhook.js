const crypto = require('crypto');
const config = require('../config');

/**
 * Instagram webhook endpoint (Meta App Dashboard → Instagram → Configure webhooks).
 * - GET: Meta's verification handshake. Echo hub.challenge when the verify token matches.
 * - POST: event delivery, signed with the Instagram app secret (X-Hub-Signature-256).
 * We don't rely on webhooks for view tracking yet; events are acknowledged and logged.
 * Mounted with a raw body parser so the signature can be checked.
 */
function verify(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && config.instagram.webhookVerifyToken && token === config.instagram.webhookVerifyToken) {
    return res.status(200).type('text/plain').send(String(challenge ?? ''));
  }
  return res.sendStatus(403);
}

function receive(req, res) {
  const sig = req.get('x-hub-signature-256') || '';
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  const expected = `sha256=${crypto.createHmac('sha256', config.instagram.appSecret || '').update(raw).digest('hex')}`;
  const ok = config.instagram.appSecret && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) return res.sendStatus(401);
  try {
    const body = JSON.parse(raw.toString('utf8') || '{}');
    console.log('[ig-webhook]', body.object, (body.entry || []).length, 'entries');
  } catch {
    /* ignore malformed JSON; still acknowledge so Meta doesn't retry forever */
  }
  res.sendStatus(200);
}

module.exports = { verify, receive };
