// O1.1 — Google login flow in-process: real handlers + local Postgres,
// fake Google token endpoint (this session has no route to Google).
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret-not-real';
process.env.SESSION_SECRET = 'x'.repeat(40);
delete process.env.APP_BASE_URL;

const { getPool, closePool } = require('../api/_lib/db');
const session = require('../api/_lib/session');
const oauth = require('../api/_lib/oauth');
const google = require('../api/auth/google');
const callback = require('../api/auth/callback');
const logout = require('../api/auth/logout');
const { call, cookieHeader } = require('./_http');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const idToken = (claims) => `${b64({ alg: 'RS256' })}.${b64(claims)}.sig`;
let tokenClaims;
callback.fetchImpl = async (url, opts) => {
  assert.equal(url, oauth.TOKEN_URL);
  const p = new URLSearchParams(opts.body);
  assert.ok(p.get('code_verifier'), 'PKCE verifier sent');
  assert.equal(p.get('redirect_uri'), 'http://localhost:3000/api/auth/callback');
  return { ok: true, status: 200, json: async () => ({ id_token: idToken(tokenClaims) }) };
};

async function startLogin(headers = {}) {
  const r = await call(google, { url: '/api/auth/google', headers });
  const loc = new URL(r.getHeader('location'));
  return { r, loc, pending: session.verify(r.cookies[0].split(';')[0].split('=')[1]) };
}

test.before(async () => { await getPool().query('truncate app_users cascade'); });
test.after(closePool);

test('start: redirects to Google with PKCE, nonce, minimal scopes; sets short-lived cookie', async () => {
  const { r, loc, pending } = await startLogin();
  console.log('  302 ->', `${loc.origin}${loc.pathname}`, '| scope =', loc.searchParams.get('scope'));
  console.log('  cookie:', r.cookies[0].replace(/=[^;]+/, '=<signed>'));
  assert.equal(r.statusCode, 302);
  assert.equal(loc.host, 'accounts.google.com');
  assert.equal(loc.searchParams.get('scope'), 'openid email profile');
  assert.equal(loc.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(loc.searchParams.get('code_challenge'), oauth.challenge(pending.verifier));
  assert.equal(loc.searchParams.get('nonce'), pending.nonce);
  assert.match(r.cookies[0], /HttpOnly; SameSite=Lax/);
  assert.match(r.cookies[0], /Path=\/api\/auth/);
});

test('start: unknown Host is refused', async () => {
  const r = await call(google, { url: '/api/auth/google', headers: { host: 'evil.example.com' } });
  assert.equal(r.getHeader('location'), '/prijava?greska=host');
});

test('start: preview and production hosts are allowed', () => {
  for (const host of ['www.eai-zdravo.com', 'eai-zdravo-web-git-claude-o1-onboarding-dashboard-dowlaingreens-projects.vercel.app']) {
    assert.equal(oauth.baseUrl({ headers: { host } }), `https://${host}`);
  }
  assert.equal(oauth.baseUrl({ headers: { host: 'eai-zdravo-web-git-x-attacker.vercel.app' } }), null);
});

test('callback: new user -> session cookie -> /onboarding/1', async () => {
  const { r, loc, pending } = await startLogin();
  tokenClaims = { iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID, sub: 'g-123',
    email: 'Vlado@Example.com', email_verified: true, name: 'Vlado', nonce: pending.nonce, exp: Date.now() / 1000 + 300 };
  const cb = await call(callback, {
    url: `/api/auth/callback?code=abc&state=${loc.searchParams.get('state')}`,
    headers: { cookie: cookieHeader(r) },
  });
  console.log('  302 ->', cb.getHeader('location'));
  assert.equal(cb.getHeader('location'), '/onboarding/1');
  const sess = cb.cookies.find((c) => c.startsWith('eai_session=') && !c.startsWith('eai_session=;'));
  assert.ok(sess, 'session cookie set');
  assert.match(sess, /HttpOnly; SameSite=Lax/);
  const uid = session.verify(decodeURIComponent(sess.split(';')[0].split('=')[1])).uid;
  const { rows } = await getPool().query('select email, google_sub from app_users where id = $1', [uid]);
  console.log('  db:', rows[0]);
  assert.deepEqual(rows[0], { email: 'vlado@example.com', google_sub: 'g-123' });
});

test('callback: returning user with finished onboarding -> /dashboard', async () => {
  await getPool().query(`update app_profiles set onboarding_step = 7, onboarding_completed_at = now()
                         where user_id = (select id from app_users where google_sub = 'g-123')`);
  const { r, loc, pending } = await startLogin();
  tokenClaims = { ...tokenClaims, nonce: pending.nonce };
  const cb = await call(callback, { url: `/api/auth/callback?code=abc&state=${loc.searchParams.get('state')}`, headers: { cookie: cookieHeader(r) } });
  assert.equal(cb.getHeader('location'), '/dashboard');
  const { rows } = await getPool().query('select count(*)::int as n from app_users');
  assert.equal(rows[0].n, 1, 'no duplicate user');
});

test('callback: wrong state -> /prijava?greska=istek, no session', async () => {
  const { r } = await startLogin();
  const cb = await call(callback, { url: '/api/auth/callback?code=abc&state=forged', headers: { cookie: cookieHeader(r) } });
  assert.equal(cb.getHeader('location'), '/prijava?greska=istek');
  assert.ok(!cb.cookies.some((c) => /^eai_session=[^;]/.test(c)));
});

test('callback: token for another app (aud) or bad nonce or unverified email -> greska=google', async () => {
  for (const bad of [{ aud: 'other-app' }, { nonce: 'replayed' }, { email_verified: false }, { exp: Date.now() / 1000 - 10 }]) {
    const { r, loc, pending } = await startLogin();
    tokenClaims = { iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID, sub: 'g-999',
      email: 'x@example.com', email_verified: true, nonce: pending.nonce, exp: Date.now() / 1000 + 300, ...bad };
    const cb = await call(callback, { url: `/api/auth/callback?code=abc&state=${loc.searchParams.get('state')}`, headers: { cookie: cookieHeader(r) } });
    assert.equal(cb.getHeader('location'), '/prijava?greska=google', JSON.stringify(bad));
  }
});

test('callback: user cancelled on Google -> greska=odustao', async () => {
  const cb = await call(callback, { url: '/api/auth/callback?error=access_denied' });
  assert.equal(cb.getHeader('location'), '/prijava?greska=odustao');
});

test('session: tampered or expired token is rejected', () => {
  const t = session.sign({ uid: 'u1', exp: Date.now() + 1000 });
  assert.equal(session.verify(t).uid, 'u1');
  assert.equal(session.verify(t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))), null);
  const forged = `${Buffer.from(JSON.stringify({ uid: 'admin', exp: Date.now() + 1e6 })).toString('base64url')}.${t.split('.')[1]}`;
  assert.equal(session.verify(forged), null);
  assert.equal(session.verify(session.sign({ uid: 'u1', exp: Date.now() - 1 })), null);
});

test('missing env -> login shows "uskoro", never crashes', async () => {
  const saved = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  const r = await call(google, { url: '/api/auth/google' });
  process.env.GOOGLE_CLIENT_ID = saved;
  assert.equal(r.getHeader('location'), '/prijava?greska=uskoro');
});

test('logout clears the session cookie', async () => {
  const r = await call(logout, { url: '/api/auth/logout' });
  assert.equal(r.getHeader('location'), '/');
  assert.match(r.cookies[0], /^eai_session=; .*Max-Age=0/);
});
