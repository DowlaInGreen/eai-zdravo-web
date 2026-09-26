const crypto = require('crypto');
function secret() { return process.env.WELCOME_SECRET || process.env.BREVO_API_KEY || ''; }
function b64url(s) { return Buffer.from(s, 'utf8').toString('base64url'); }
function sign(email) { return crypto.createHmac('sha256', secret()).update('welcome:' + email).digest('base64url').slice(0, 22); }
function verify(email, sig) {
  if (!email || !sig || !secret()) return false;
  const a = Buffer.from(sign(email)); const b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
module.exports = { b64url, sign, verify };
