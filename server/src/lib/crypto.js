const crypto = require('crypto');
const config = require('../config');

// AES-256-GCM for stored third-party tokens (e.g. Instagram access tokens).
// TOKEN_ENCRYPTION_KEY: 32 random bytes, base64. In dev a key is derived from JWT_SECRET.
function key() {
  if (config.tokenEncryptionKey) {
    const k = Buffer.from(config.tokenEncryptionKey, 'base64');
    if (k.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
    return k;
  }
  if (config.isProd) throw new Error('TOKEN_ENCRYPTION_KEY must be set in production');
  return crypto.createHash('sha256').update(`dev-token-key:${config.jwtSecret}`).digest();
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}

function decrypt(packed) {
  const [v, iv, tag, data] = String(packed).split('.');
  if (v !== 'v1') throw new Error('Unknown token format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
