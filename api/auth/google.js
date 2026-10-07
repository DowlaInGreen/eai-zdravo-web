// GET /api/auth/google — start "Nastavi s Googleom".
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET (≥32 chars), POSTGRES_URL.
const oauth = require('../_lib/oauth');
const session = require('../_lib/session');
const { redirect, query } = require('../_lib/http');

module.exports = async function handler(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !session.secret() || !process.env.POSTGRES_URL) {
    return redirect(res, '/prijava?greska=uskoro');
  }
  const base = oauth.baseUrl(req);
  if (!base) return redirect(res, '/prijava?greska=host');

  const state = oauth.rand();
  const verifier = oauth.rand(48);
  const nonce = oauth.rand();
  const next = oauth.safeNext(query(req).next);
  const token = session.sign({ state, verifier, nonce, next, exp: Date.now() + 10 * 60 * 1000 });
  session.appendCookie(res, session.cookie(session.OAUTH_COOKIE, token, {
    maxAge: 600, path: '/api/auth', secure: session.isSecureRequest(req),
  }));
  return redirect(res, oauth.authUrl({
    clientId: process.env.GOOGLE_CLIENT_ID,
    redirectUri: `${base}/api/auth/callback`,
    state, verifier, nonce,
  }));
};
