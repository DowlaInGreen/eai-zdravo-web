// O1.3 — onboarding API end-to-end (handlers + local Postgres) and validators.
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SESSION_SECRET = 'y'.repeat(40);

const { getPool, closePool } = require('../api/_lib/db');
const store = require('../api/_lib/store');
const session = require('../api/_lib/session');
const { validateStep, householdShares } = require('../api/_lib/onboarding');
const onboarding = require('../api/onboarding');
const me = require('../api/me');
const account = require('../api/account');
const { call } = require('./_http');

let uid, cookie;
const post = (step, data, extra = {}) => call(onboarding, {
  method: 'POST', url: '/api/onboarding',
  headers: { cookie, 'content-type': 'application/json', origin: 'http://localhost:3000', ...extra.headers },
  body: { step, data, ...extra.body },
});
const getMe = () => call(me, { url: '/api/me', headers: { cookie } });

test.before(async () => {
  await getPool().query('truncate app_users cascade');
  uid = (await store.upsertGoogleUser({ sub: 'g-onb', email: 'test@example.com', name: 'Test' })).id;
  cookie = `eai_session=${session.sign({ uid, exp: Date.now() + 60000 })}`;
});
test.after(closePool);

test('unauthenticated -> 401', async () => {
  const r = await call(me, { url: '/api/me' });
  assert.equal(r.statusCode, 401);
  assert.equal(r.json.login, '/prijava');
});

test('cross-site requests are refused (form post / foreign origin)', async () => {
  const r1 = await post(1, { consent: false }, { headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  const r2 = await post(1, { consent: false }, { headers: { origin: 'https://evil.example.com' } });
  assert.equal(r1.statusCode, 403);
  assert.equal(r2.statusCode, 403);
});

test('cannot jump ahead to step 4 before step 1', async () => {
  const r = await post(4, { program: 'modern' });
  assert.equal(r.statusCode, 409);
  assert.equal(r.json.step, 1);
});

test('out-of-range weight rejected with Croatian error', async () => {
  const r = await post(1, { consent: true, birth_year: 1986, height_cm: 182, weight_kg: 400 });
  console.log('  400 ->', JSON.stringify(r.json));
  assert.equal(r.statusCode, 400);
  assert.equal(r.json.errors.weight_kg, 'Težina između 30 i 250 kg.');
});

test('full flow 1..6, resume after step 3, rows in DB', async () => {
  const steps = [
    [1, { consent: true, birth_year: 1986, height_cm: 182, weight_kg: 88 }],
    [2, { goals: ['save_money', 'less_time'] }],
    [3, { trains: true, training_goal: 'build_muscle', plan_status: ['needs_ideas', 'online_challenges', 'wants_trainer_referral'], trainer_mode: 'in_person' }],
  ];
  for (const [s, d] of steps) {
    const r = await post(s, d);
    assert.equal(r.statusCode, 200, JSON.stringify(r.json));
    assert.equal(r.json.next, `/onboarding/${s + 1}`);
  }
  // "refresh": the page asks /api/me where to resume
  const mid = await getMe();
  assert.equal(mid.json.profile.onboarding_step, 4, 'resume at step 4');

  const r4 = await post(4, { program: 'old_school', diets: ['vegan', 'lactose_free'] });
  assert.deepEqual(r4.json.warnings, ['veg_vs_program'], 'conflict warning, not blocking');
  assert.equal((await post(5, { allergens: ['tree_nuts'], dislikes: 'jetrica' })).statusCode, 200);
  const r6 = await post(6, { adults: 2, children: 1 });
  assert.equal(r6.json.next, '/dashboard');

  const rows = await getPool().query(`
    select p.onboarding_step, p.onboarding_completed_at is not null as done, p.birth_year, p.height_cm, p.weight_kg::float8,
           p.health_consent_at is not null as consent, p.goals, t.trains, t.training_goal, t.plan_status, t.trainer_mode,
           h.program, h.plan_style, h.diets, h.allergens, h.dislikes, h.adults, h.children, l.mode as lead_mode, l.status as lead_status
    from app_profiles p join app_training t using (user_id) join app_households h using (user_id)
    left join app_trainer_leads l using (user_id) where p.user_id = $1`, [uid]);
  console.log('  db row:', JSON.stringify(rows.rows[0]));
  const row = rows.rows[0];
  assert.equal(row.done, true);
  assert.equal(row.plan_style, 'old_school');
  assert.equal(row.lead_mode, 'in_person');
  assert.equal(row.adults, 2);
});

test('/api/me returns profile + empty savings, no google_sub', async () => {
  const r = await getMe();
  assert.equal(r.statusCode, 200);
  assert.equal(r.json.household.children, 1);
  assert.equal(r.json.savings.empty, true);
  assert.equal(r.json.savings.total.saving, 0);
  assert.ok(!JSON.stringify(r.json).includes('g-onb'), 'google_sub never exposed');
});

test('edit mode after completion returns to /dashboard', async () => {
  const r = await post(2, { goals: ['kid_friendly'] }, { body: { edit: true } });
  assert.equal(r.json.next, '/dashboard');
});

test('step 3 "Ne" clears training fields and closes the lead', async () => {
  await post(3, { trains: false, training_goal: 'build_muscle' });
  const r = await getMe();
  assert.deepEqual(r.json.training, { trains: false, training_goal: null, plan_status: [], trainer_mode: null });
  assert.equal(r.json.trainerLead.status, 'closed');
});

test('delete account -> 200, session cleared, data gone', async () => {
  const r = await call(account, { method: 'DELETE', url: '/api/account', headers: { cookie, 'content-type': 'application/json' } });
  assert.equal(r.statusCode, 200);
  assert.match(r.cookies[0], /^eai_session=; .*Max-Age=0/);
  const after = await getMe();
  assert.equal(after.statusCode, 401);
  const { rows } = await getPool().query('select count(*)::int as n from app_households where user_id = $1', [uid]);
  assert.equal(rows[0].n, 0);
});

test('validators', () => {
  const v = (s, d) => validateStep(s, d, { currentYear: 2026 });
  assert.equal(v(1, { consent: true, birth_year: 2015 }).ok, false, 'younger than 14');
  assert.deepEqual(v(1, { consent: false, weight_kg: 80 }).data, { consent: false, birth_year: null, height_cm: null, weight_kg: null });
  assert.equal(v(2, { goals: ['save_money', 'less_time', 'kid_friendly'] }).ok, false, 'max 2 goals');
  assert.equal(v(3, { trains: true, training_goal: 'build_muscle', plan_status: ['wants_trainer_referral'] }).ok, false, 'mode required');
  assert.deepEqual(v(4, { program: 'survivor', diets: ['keto'] }).warnings, ['keto_vs_survivor']);
  assert.equal(v(4, { program: 'paleo' }).ok, false);
  assert.equal(v(5, { allergens: ['gluten', 'unicorn'] }).ok, false);
  assert.deepEqual(v(5, { none: true, allergens: ['gluten'] }).data.allergens, []);
  assert.equal(v(6, { adults: 0, children: 1 }).ok, false);
  assert.equal(v(6, { adults: 9, children: 0 }).ok, false);
});

test('household shares: 2 adults + 1 child = 2,5 portions, 40/40/20', () => {
  const s = householdShares(2, 1);
  assert.equal(s.portions, 2.5);
  assert.equal(Math.round(s.adultShare * 100), 40);
  assert.equal(Math.round(s.childShare * 100), 20);
});
