const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const rateLimit = require('./middleware/rateLimit');

// Built web app (npm run build). In production the API serves it, so the site,
// the API and the Instagram callback all live on one domain.
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // SAMEORIGIN (not DENY): Firebase's sign-in helper frame under /__/auth must load on our own pages.
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    // Lets the Google sign-in popup talk back to this page.
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  });
  if (config.isProd) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

// Jest sets NODE_ENV=test; tests sign in many times, so limits are off there.
function createApp({ rateLimits = process.env.NODE_ENV !== 'test', serveClient = config.isProd } = {}) {
  const app = express();
  const limit = (opts) => (rateLimits ? rateLimit(opts) : (req, res, next) => next());
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(
    cors({
      // Same-origin requests send no Origin header; cross-origin only from known sites.
      origin: (origin, cb) => cb(null, !origin || config.allowedOrigins.includes(origin)),
    })
  );

  // Firebase sign-in helper pages on our own domain (see routes/firebaseAuthProxy.js).
  app.use('/__/auth', require('./routes/firebaseAuthProxy').firebaseAuthProxy());

  // Instagram webhooks need the raw body for signature checks, so they come before express.json().
  const igWebhook = require('./routes/igWebhook');
  app.get('/api/social/instagram/webhook', igWebhook.verify);
  app.post('/api/social/instagram/webhook', express.raw({ type: '*/*', limit: '1mb' }), igWebhook.receive);

  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth/otp', limit({ windowMs: 10 * 60 * 1000, max: 10, key: (req) => `${req.ip}:${req.path}` }));
  // Only sign-in attempts are limited (per IP); page loads (GET /me, /config) never are.
  app.use('/api/auth', limit({ windowMs: 60 * 1000, max: 40, skip: (req) => req.method === 'GET' }), require('./routes/auth'));
  app.use('/api/onboarding', require('./routes/onboarding'));
  app.use('/api/leads', limit({ windowMs: 60 * 60 * 1000, max: 10, skip: (req) => req.method === 'GET' }), require('./routes/leads'));
  app.use('/api/campaigns', require('./routes/campaigns'));
  // Per signed-in person, so a shared college Wi-Fi doesn't share one limit.
  app.use('/api/submissions', limit({ windowMs: 60 * 1000, max: 120, key: rateLimit.userOrIp }), require('./routes/submissions'));
  app.use('/api/social', limit({ windowMs: 60 * 1000, max: 120, key: rateLimit.userOrIp }), require('./routes/social'));
  app.use('/api/brand', limit({ windowMs: 60 * 1000, max: 120, key: rateLimit.userOrIp }), require('./routes/brand'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/chat', require('./routes/chat'));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  if (serveClient && fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    // Hashed assets can be cached forever; index.html must always be fresh.
    app.use('/assets', express.static(path.join(CLIENT_DIST, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
    app.get(/.*/, (req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  // Express 5 forwards rejected promises from async handlers here.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}

module.exports = { createApp };
