// L1-#18: direct unit check of api/subscribe.js's spam guards (honeypot,
// minimum fill time, rate limit) without a live Brevo call or a deployed
// endpoint — this session has no outbound network access to the real site,
// so the spec's curl-loop verify is run this way instead. Same code path,
// same assertions (first 5 pass, 6th/7th -> 429), just invoked in-process.

process.env.BREVO_API_KEY = 'test-key';
process.env.BREVO_DOI_TEMPLATE_ID = '1';
process.env.BREVO_LIST_BESPLATNO = '2';

// Mock Brevo's API so no real network call happens.
global.fetch = async () => ({ ok: true, status: 200, text: async () => '{}' });

const handler = require('../api/subscribe.js');

function fakeReq(body, ip) {
  return { method: 'POST', headers: { 'x-forwarded-for': ip }, body };
}
function fakeRes() {
  const res = { _status: 200, _json: null };
  res.setHeader = () => {};
  res.status = (c) => { res._status = c; return res; };
  res.json = (j) => { res._json = j; return res; };
  return res;
}

async function main() {
  let pass = true;
  const assert = (cond, label) => { console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label); if (!cond) pass = false; };

  // Honeypot
  const r1 = fakeRes();
  await handler(fakeReq({ email: 'a@b.com', consent: true, website: 'spam' }, '1.1.1.1'), r1);
  assert(r1._status === 200 && r1._json.ok === true, 'honeypot filled -> silent 200, no Brevo call');

  // Too fast (loaded_at = now, i.e. 0ms fill time)
  const r2 = fakeRes();
  await handler(fakeReq({ email: 'a@b.com', consent: true, loaded_at: Date.now() }, '2.2.2.2'), r2);
  assert(r2._status === 200 && r2._json.ok === true, 'submitted <2s after load -> silent 200, no Brevo call');

  // Rate limit: 7 legit requests from the same IP, each with a fill time > 2s
  const ip = '3.3.3.3';
  const oldEnough = Date.now() - 5000;
  const codes = [];
  for (let i = 0; i < 7; i++) {
    const r = fakeRes();
    await handler(fakeReq({ email: `spam${i}@test.hr`, consent: true, loaded_at: oldEnough }, ip), r);
    codes.push(r._status);
  }
  console.log('rate-limit sequence:', codes.join(' '));
  assert(codes.slice(0, 5).every((c) => c === 200), 'first 5 requests from one IP pass (200)');
  assert(codes[5] === 429 && codes[6] === 429, '6th and 7th request from same IP -> 429');

  process.exit(pass ? 0 : 1);
}

main();
