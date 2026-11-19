const config = require('../config');

/**
 * Serves Firebase's sign-in helper pages (/__/auth/*) from our own domain by forwarding
 * them to <project>.firebaseapp.com. Browsers that block third-party storage (Safari,
 * Chrome) otherwise break redirect sign-in. Firebase's documented "proxy" option.
 * The web app sets authDomain to its own host in production to use this.
 */
const HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length', 'host']);

function firebaseAuthProxy() {
  const target = `https://${config.firebaseProjectId}.firebaseapp.com`;
  return async (req, res, next) => {
    if (!config.firebaseProjectId) return next();
    try {
      const headers = {};
      for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k.toLowerCase())) headers[k] = v;
      const upstream = await fetch(`${target}${req.originalUrl}`, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
        duplex: 'half',
        redirect: 'manual',
      });
      res.status(upstream.status);
      // Firebase serves these pages without these headers. A Cross-Origin-Opener-Policy here cuts
      // the link between the sign-in popup and the page that opened it, so the popup never
      // finishes ("keeps loading" after choosing an account).
      res.removeHeader('Cross-Origin-Opener-Policy');
      res.removeHeader('Referrer-Policy');
      upstream.headers.forEach((v, k) => {
        if (!HOP.has(k.toLowerCase())) res.setHeader(k, v);
      });
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      console.warn('[auth-proxy] failed:', err.message);
      res.status(502).send('Sign-in helper unavailable');
    }
  };
}

module.exports = { firebaseAuthProxy };
