const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const isProd = process.env.NODE_ENV === 'production';
const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);
const originOf = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

// Public web address of the app. In production the API also serves the web app,
// so this is the one domain users visit (e.g. https://creatorperks.in).
const clientOrigin = (process.env.CLIENT_ORIGIN || process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');

// Instagram sends people back here after "Allow". In production it must be on our own site:
// a leftover dev value (e.g. an ngrok tunnel) would send real users to a dev machine.
const defaultIgRedirect = `${clientOrigin}/api/social/instagram/callback`;
let igRedirect = process.env.INSTAGRAM_REDIRECT_URI || defaultIgRedirect;
if (isProd && originOf(igRedirect) !== originOf(clientOrigin)) {
  console.warn(`[config] Ignoring INSTAGRAM_REDIRECT_URI (${originOf(igRedirect)}): it isn't on ${clientOrigin}. Using ${defaultIgRedirect}`);
  igRedirect = defaultIgRedirect;
}

const instagram = {
  appId: process.env.INSTAGRAM_APP_ID || '',
  appSecret: process.env.INSTAGRAM_APP_SECRET || '',
  // Defaults to <clientOrigin>/api/social/instagram/callback. Must match Meta's dashboard exactly.
  redirectUri: igRedirect,
  graphVersion: process.env.INSTAGRAM_GRAPH_VERSION || 'v27.0',
  // Any random string; paste the same value as the Verify token in Meta's webhook settings.
  webhookVerifyToken: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || '',
};

/**
 * Web origins the app may send people back to (CORS + post-Instagram redirect).
 * Always includes CLIENT_ORIGIN and the Instagram callback's host; localhost in dev.
 */
const allowedOrigins = [
  ...new Set(
    [
      clientOrigin,
      originOf(instagram.redirectUri),
      ...list(process.env.ALLOWED_ORIGINS).map(originOf),
      ...(isProd ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']),
    ].filter(Boolean)
  ),
];

const config = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret',
  // Comma-separated emails that become admins on sign-in.
  adminEmails: list(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  clientOrigin,
  allowedOrigins,
  // Dev-only email-code sign-in for the seeded demo accounts. Never on in production.
  exposeDevOtp: !isProd,
  // Email + password sign-in for app reviewers (Meta, Google), who can't use our Google sign-in.
  // On only when both are set and the password is at least 12 characters. Never an admin.
  reviewLogin: {
    email: (process.env.REVIEW_LOGIN_EMAIL || '').trim().toLowerCase(),
    password: process.env.REVIEW_LOGIN_PASSWORD || '',
  },
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  // 32 random bytes, base64. Encrypts stored Instagram tokens. Required in production.
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || '',
  instagram,
  // YouTube Data API v3 key (server-side) for reading public video stats.
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  // Same project as the web app's VITE_FIREBASE_PROJECT_ID.
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '',
};

/** Fail fast in production on missing essentials; warn about optional features. */
function checkConfig({ log = console } = {}) {
  const missing = [];
  if (isProd) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) missing.push('JWT_SECRET (32+ random characters)');
    if (!config.mongoUri) missing.push('MONGODB_URI');
    if (!config.tokenEncryptionKey) missing.push('TOKEN_ENCRYPTION_KEY');
    if (!process.env.CLIENT_ORIGIN && !process.env.PUBLIC_URL) missing.push('CLIENT_ORIGIN (your https domain)');
    if (!clientOrigin.startsWith('https://')) missing.push('CLIENT_ORIGIN must be https');
  }
  if (missing.length) throw new Error(`Missing production settings: ${missing.join(', ')}`);

  const off = [];
  if (!config.firebaseProjectId) off.push('Google sign-in (FIREBASE_PROJECT_ID)');
  if (!(instagram.appId && instagram.appSecret)) off.push('Instagram connect (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET)');
  if (!config.youtubeApiKey) off.push('YouTube stats (YOUTUBE_API_KEY)');
  if (off.length) log.warn(`[config] Off until configured: ${off.join('; ')}`);
  if (isProd && !instagram.redirectUri.startsWith('https://')) log.warn('[config] INSTAGRAM_REDIRECT_URI should be https');
}

module.exports = config;
module.exports.checkConfig = checkConfig;
