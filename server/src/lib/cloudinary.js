const crypto = require('crypto');

/**
 * Cloudinary config from CLOUDINARY_URL (cloudinary://key:secret@cloud) or the three
 * CLOUDINARY_* variables. Returns null when not configured.
 */
function cloudinaryConfig(env = process.env) {
  if (env.CLOUDINARY_URL) {
    try {
      const u = new URL(env.CLOUDINARY_URL);
      return { cloudName: u.hostname, apiKey: decodeURIComponent(u.username), apiSecret: decodeURIComponent(u.password) };
    } catch {
      return null;
    }
  }
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = env;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

/**
 * Signature for a direct browser upload (the secret never leaves the server).
 * Cloudinary: sha1 of the alphabetically-sorted "k=v&k=v" params + api_secret.
 */
function signUpload(params, apiSecret) {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

module.exports = { cloudinaryConfig, signUpload };
