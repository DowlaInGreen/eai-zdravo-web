// Google OAuth 2.0 / OpenID Connect — authorization code flow with PKCE.
// Scopes: openid email profile only. Pure helpers; network call is injectable for tests.
const crypto = require('crypto');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

// Hosts allowed to start a login. Prevents Host-header tricks from sending the
// OAuth redirect anywhere else. Previews: eai-zdravo-web-*-dowlaingreens-projects.vercel.app
const ALLOWED_HOST = [
  /^www\.eai-zdravo\.com$/,
  /^eai-zdravo\.com$/,
  /^eai-zdravo-web(-[a-z0-9-]+)?-dowlaingreens-projects\.vercel\.app$/,
  /^eai-zdravo-web\.vercel\.app$/,
  /^(localhost|127\.0\.0\.1):\d+$/,
];

function baseUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  if (!ALLOWED_HOST.some((re) => re.test(host))) return null;
  const local = /^(localhost|127\.0\.0\.1):/.test(host);
  return `${local ? 'http' : 'https'}://${host}`;
}

const rand = (n = 32) => crypto.randomBytes(n).toString('base64url');
const challenge = (verifier) => crypto.createHash('sha256').update(verifier).digest('base64url');

function authUrl({ clientId, redirectUri, state, verifier, nonce }) {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: challenge(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${AUTH_URL}?${q}`;
}

async function exchangeCode({ code, verifier, redirectUri, clientId, clientSecret, fetchImpl = fetch }) {
  const r = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, code_verifier: verifier, redirect_uri: redirectUri,
      client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code',
    }).toString(),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || !json.id_token) {
    const err = new Error(`token_exchange_failed:${r.status}:${json.error || 'no_id_token'}`);
    err.code = 'token';
    throw err;
  }
  return json;
}

// The ID token comes straight from Google's token endpoint over TLS (server to
// server), so per OIDC Core 3.1.3.7 the TLS server validation may replace the
// signature check. Claims are still validated strictly.
function parseIdToken(idToken, { clientId, nonce, now = Date.now() }) {
  const parts = String(idToken).split('.');
  if (parts.length !== 3) throw Object.assign(new Error('bad_id_token'), { code: 'id_token' });
  let c;
  try { c = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch {
    throw Object.assign(new Error('bad_id_token'), { code: 'id_token' });
  }
  const fail = (why) => { throw Object.assign(new Error(why), { code: 'id_token' }); };
  if (!ISSUERS.includes(c.iss)) fail('bad_iss');
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(clientId)) fail('bad_aud');
  if (typeof c.exp !== 'number' || c.exp * 1000 < now) fail('expired');
  if (!nonce || c.nonce !== nonce) fail('bad_nonce');
  if (!c.sub) fail('no_sub');
  if (!c.email || c.email_verified !== true) fail('email_not_verified');
  return { sub: String(c.sub), email: String(c.email).toLowerCase(), name: c.name || null, picture: c.picture || null };
}

function safeNext(next) {
  // only same-site app paths
  return typeof next === 'string' && /^\/(dashboard|onboarding)(\/[0-9])?(\?[a-z=0-9&]*)?$/.test(next) ? next : null;
}

module.exports = { baseUrl, rand, challenge, authUrl, exchangeCode, parseIdToken, safeNext, TOKEN_URL };
