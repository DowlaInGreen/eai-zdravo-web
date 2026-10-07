// GET /api/auth/callback — Google redirects here with ?code&state.
const crypto = require('crypto');
const oauth = require('../_lib/oauth');
const session = require('../_lib/session');
const store = require('../_lib/store');
const { redirect, query } = require('../_lib/http');

function sameString(a, b) {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function handler(req, res) {
  const q = query(req);
  const clearOauth = () => session.appendCookie(res, session.cookie(session.OAUTH_COOKIE, '', {
    maxAge: 0, path: '/api/auth', secure: session.isSecureRequest(req),
  }));
  const fail = (code) => { clearOauth(); return redirect(res, `/prijava?greska=${code}`); };

  if (q.error) return fail('odustao');                 // user cancelled on Google
  const base = oauth.baseUrl(req);
  if (!base) return fail('host');
  const pending = session.verify(session.parseCookies(req)[session.OAUTH_COOKIE]);
  if (!pending || !q.code || !sameString(q.state, pending.state)) return fail('istek');

  let claims;
  try {
    const tokens = await oauth.exchangeCode({
      code: q.code,
      verifier: pending.verifier,
      redirectUri: `${base}/api/auth/callback`,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      fetchImpl: module.exports.fetchImpl || fetch,
    });
    claims = oauth.parseIdToken(tokens.id_token, { clientId: process.env.GOOGLE_CLIENT_ID, nonce: pending.nonce });
  } catch (e) {
    console.error('auth callback:', e.message);        // message never contains tokens
    return fail('google');
  }

  let state;
  try {
    const user = await store.upsertGoogleUser(claims);
    state = await store.getState(user.id);
    session.setSession(req, res, user.id);
  } catch (e) {
    console.error('auth callback db:', e.message);
    return fail('baza');
  }
  clearOauth();
  const p = state.profile;
  const done = p && p.onboarding_completed_at;
  const next = pending.next || (done ? '/dashboard' : `/onboarding/${Math.min(p ? p.onboarding_step : 1, 6)}`);
  return redirect(res, next);
}

module.exports = handler;
module.exports.fetchImpl = null; // tests inject a fake Google token endpoint
