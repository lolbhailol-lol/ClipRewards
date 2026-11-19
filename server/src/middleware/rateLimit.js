/**
 * Small in-memory fixed-window limiter. Fine for a single server;
 * swap for a shared store (e.g. Redis) when running more than one instance.
 *
 * key:  what to count by (default: the client IP)
 * skip: requests that aren't counted at all
 */
function rateLimit({ windowMs, max, key = (req) => req.ip, skip = () => false }) {
  const hits = new Map();
  // Forget expired entries so the map doesn't grow forever.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.max(windowMs, 60 * 1000));
  sweep.unref?.();

  return (req, res, next) => {
    if (skip(req)) return next();
    const now = Date.now();
    const k = key(req);
    const entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      hits.set(k, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= max) {
      res.set('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
    }
    entry.count += 1;
    next();
  };
}

/**
 * Count signed-in requests per person (their session token), not per network, so many
 * students on one college Wi-Fi don't share a limit. Anonymous requests count per IP.
 * (A made-up token only skips the limit to be rejected by requireAuth anyway.)
 */
rateLimit.userOrIp = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') && h.length > 40 ? `u:${h.slice(-40)}` : `ip:${req.ip}`;
};

module.exports = rateLimit;
