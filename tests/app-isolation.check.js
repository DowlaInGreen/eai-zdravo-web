// O1.2 — data isolation + schema constraints against a throwaway local Postgres.
// Run: source tests/local-pg.sh start && psql "$POSTGRES_URL" -f scripts/app-schema.sql && node --test tests/app-isolation.check.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { getPool, closePool } = require('../api/_lib/db');
const store = require('../api/_lib/store');
const { validateStep } = require('../api/_lib/onboarding');

if (!process.env.POSTGRES_URL || !/localhost|127\.0\.0\.1/.test(process.env.POSTGRES_URL)) {
  console.error('Refusing to run: POSTGRES_URL must point at the local test DB (tests/local-pg.sh).');
  process.exit(1);
}

let A, B;
const save = (uid, step, input) => {
  const v = validateStep(step, input, { currentYear: 2026 });
  assert.ok(v.ok, JSON.stringify(v.errors));
  return store.saveStep(uid, step, v.data);
};

test.before(async () => {
  await getPool().query('truncate app_users cascade');
  A = await store.upsertGoogleUser({ sub: 'sub-A', email: 'a@example.com', name: 'Ana' });
  B = await store.upsertGoogleUser({ sub: 'sub-B', email: 'b@example.com', name: 'Bruno' });
  await save(A.id, 1, { consent: true, birth_year: 1986, height_cm: 182, weight_kg: 88 });
  await save(A.id, 3, { trains: true, training_goal: 'build_muscle', plan_status: ['wants_trainer_referral'], trainer_mode: 'in_person' });
  await save(A.id, 6, { adults: 2, children: 1 });
  await getPool().query(
    `insert into app_weekly_savings (user_id, week_start, spent_eur, baseline_eur, saving_promo_eur, saving_store_eur)
     values ($1, '2026-10-05', 40, 50, 6, 4)`, [A.id]);
});
test.after(closePool);

test('B reads none of A\'s data', async () => {
  const s = await store.getState(B.id);
  assert.equal(s.user.email, 'b@example.com');
  assert.equal(s.profile.weight_kg, null);
  assert.equal(s.profile.health_consent_at, null);
  assert.equal(s.training, null);
  assert.equal(s.household, null);
  assert.equal(s.trainerLead, null);
  assert.deepEqual(s.savingsRows, []);
});

test('A reads own data', async () => {
  const s = await store.getState(A.id);
  assert.equal(s.profile.weight_kg, 88);
  assert.equal(s.training.trainer_mode, 'in_person');
  assert.equal(s.trainerLead.mode, 'in_person');
  assert.equal(s.household.adults, 2);
  assert.equal(s.savingsRows.length, 1);
});

test('B writing all steps never changes A', async () => {
  await save(B.id, 1, { consent: true, birth_year: 1990, height_cm: 170, weight_kg: 60 });
  await save(B.id, 3, { trains: false });
  await save(B.id, 6, { adults: 1, children: 0 });
  const a = await store.getState(A.id);
  assert.equal(a.profile.weight_kg, 88);
  assert.equal(a.training.trains, true);
  assert.equal(a.household.adults, 2);
});

test('B deleting own account leaves A intact', async () => {
  assert.equal(await store.deleteUser(B.id), 1);
  assert.equal(await store.getState(B.id), null);
  const a = await store.getState(A.id);
  assert.equal(a.savingsRows.length, 1);
  const { rows } = await getPool().query('select count(*)::int as n from app_profiles where user_id = $1', [B.id]);
  assert.equal(rows[0].n, 0, 'cascade removed B profile');
});

test('DB refuses health data without consent', async () => {
  await assert.rejects(
    getPool().query('update app_profiles set weight_kg = 70, health_consent_at = null where user_id = $1', [A.id]),
    /check constraint/);
});

test('DB refuses trainer referral without mode', async () => {
  await assert.rejects(
    getPool().query(`update app_training set trainer_mode = null where user_id = $1`, [A.id]),
    /check constraint/);
});

test('DB refuses week_start that is not a Monday', async () => {
  await assert.rejects(
    getPool().query(`insert into app_weekly_savings (user_id, week_start, spent_eur, baseline_eur) values ($1, '2026-10-06', 1, 1)`, [A.id]),
    /check constraint/);
});

test('onboarding step never moves backwards; step 6 completes', async () => {
  await save(A.id, 2, { goals: ['save_money'] }); // editing step 2 after step 6
  const s = await store.getState(A.id);
  assert.equal(s.profile.onboarding_step, 7);
  assert.ok(s.profile.onboarding_completed_at);
});

test('one open trainer lead per user; unchecking closes it', async () => {
  await save(A.id, 3, { trains: true, training_goal: 'build_muscle', plan_status: ['wants_trainer_referral'], trainer_mode: 'online' });
  let { rows } = await getPool().query(`select mode, status from app_trainer_leads where user_id = $1`, [A.id]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].mode, 'online');
  await save(A.id, 3, { trains: true, training_goal: 'build_muscle', plan_status: [] });
  ({ rows } = await getPool().query(`select status from app_trainer_leads where user_id = $1`, [A.id]));
  assert.equal(rows[0].status, 'closed');
});

test('withdrawing consent wipes health fields', async () => {
  await save(A.id, 1, { consent: false, birth_year: 1986 });
  const s = await store.getState(A.id);
  assert.equal(s.profile.birth_year, null);
  assert.equal(s.profile.weight_kg, null);
  assert.equal(s.profile.health_consent_at, null);
});
