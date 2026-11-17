const crypto = require('crypto');
const Otp = require('../models/Otp');

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hash = (code) => crypto.createHash('sha256').update(code).digest('hex');

async function issueOtp(email) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await Otp.deleteMany({ email });
  await Otp.create({ email, codeHash: hash(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) });
  return code;
}

/** Returns true when the code matches; consumes the OTP on success. */
async function verifyOtp(email, code) {
  const otp = await Otp.findOne({ email });
  if (!otp || otp.expiresAt < new Date()) return false;
  if (otp.attempts >= MAX_ATTEMPTS) {
    await otp.deleteOne();
    return false;
  }
  const a = Buffer.from(otp.codeHash);
  const b = Buffer.from(hash(String(code)));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    otp.attempts += 1;
    await otp.save();
    return false;
  }
  await otp.deleteOne();
  return true;
}

module.exports = { issueOtp, verifyOtp };
