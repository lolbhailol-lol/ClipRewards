const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, config.jwtSecret, { expiresIn: '30d' });

async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please sign in' });
  try {
    const { sub } = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(sub);
    if (!user) return res.status(401).json({ error: 'Account not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have access to this' });
  }
  next();
};

module.exports = { signToken, requireAuth, requireRole };
