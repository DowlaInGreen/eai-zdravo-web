// Signed, HttpOnly session cookie (no server-side session store).
// Token = base64url(JSON payload) + "." + HMAC-SHA256 with SESSION_SECRET.
const crypto = require('crypto');

const SESSION_COOKIE = 'eai_session';
const OAUTH_COOKIE = 'eai_oauth';
const SESSION_DAYS = 30;

function secret() {
  const s = process.env.SESSION_SECRET || '';
  return s.length >= 32 ? s : '';
}

function mac(data) {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

function sign(payload) {
  if (!secret()) throw new Error('SESSION_SECRET missing or shorter than 32 chars');
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${mac(body)}`;
}

function verify(token, now = Date.now()) {
  if (!token || !secret()) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(mac(body));
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!payload || typeof payload.exp !== 'number' || payload.exp < now) return null;
  return payload;
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function cookie(name, value, { maxAge, path = '/', secure = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

function isSecureRequest(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  return !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

function appendCookie(res, value) {
  const prev = res.getHeader('Set-Cookie');
  const list = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
  res.setHeader('Set-Cookie', [...list, value]);
}

function setSession(req, res, userId, now = Date.now()) {
  const token = sign({ uid: userId, exp: now + SESSION_DAYS * 864e5 });
  appendCookie(res, cookie(SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 86400, secure: isSecureRequest(req) }));
}

function clearSession(req, res) {
  appendCookie(res, cookie(SESSION_COOKIE, '', { maxAge: 0, secure: isSecureRequest(req) }));
}

function sessionUserId(req) {
  const p = verify(parseCookies(req)[SESSION_COOKIE]);
  return p && typeof p.uid === 'string' ? p.uid : null;
}

module.exports = {
  SESSION_COOKIE, OAUTH_COOKIE, sign, verify, parseCookies, cookie, appendCookie,
  isSecureRequest, setSession, clearSession, sessionUserId, secret,
};
