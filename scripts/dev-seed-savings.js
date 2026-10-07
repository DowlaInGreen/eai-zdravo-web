// DEV ONLY — fills 6 test weeks of savings for one test user so the dashboard
// can be checked. Rows are marked plan_ref='SEED'.
//   node scripts/dev-seed-savings.js test@example.com            # seed
//   node scripts/dev-seed-savings.js test@example.com --cleanup  # remove SEED rows
// Refuses NODE_ENV=production. A non-local DB additionally needs --remote.
const { getPool, closePool } = require('../api/_lib/db');
const { mondayOf, zagrebDate } = require('../api/_lib/savings');

const [email, ...flags] = process.argv.slice(2);
if (process.env.NODE_ENV === 'production') { console.error('REFUSED: NODE_ENV=production'); process.exit(1); }
if (!email) { console.error('usage: node scripts/dev-seed-savings.js <email> [--cleanup] [--remote]'); process.exit(1); }
const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.POSTGRES_URL || '');
if (!local && !flags.includes('--remote')) { console.error('REFUSED: POSTGRES_URL is not local; add --remote if this is really a test DB'); process.exit(1); }

(async () => {
  const db = getPool();
  const u = await db.query('select id from app_users where email = $1', [email.toLowerCase()]);
  if (!u.rows[0]) { console.error(`no user ${email}`); process.exit(1); }
  const uid = u.rows[0].id;
  if (flags.includes('--cleanup')) {
    const r = await db.query(`delete from app_weekly_savings where user_id = $1 and plan_ref = 'SEED'`, [uid]);
    console.log(`removed ${r.rowCount} SEED rows`);
  } else {
    // 6 weeks ending with the current one; numbers are test data, not real prices
    const sample = [[52.4, 6.1, 2.3], [48.9, 4.8, 1.9], [55.1, 7.2, 2.6], [50.3, 5.4, 1.2], [47.6, 6.6, 2.0], [53.8, 5.9, 2.4]];
    const thisWeek = new Date(`${mondayOf(zagrebDate(new Date()))}T00:00:00Z`);
    let n = 0;
    for (let i = 0; i < sample.length; i++) {
      const d = new Date(thisWeek); d.setUTCDate(d.getUTCDate() - 7 * (sample.length - 1 - i));
      const [base, promo, store] = sample[i];
      await db.query(
        `insert into app_weekly_savings (user_id, week_start, spent_eur, baseline_eur, saving_promo_eur, saving_store_eur, source, plan_ref)
         values ($1, $2, $3, $4, $5, $6, 'plan', 'SEED')
         on conflict (user_id, week_start) do update set spent_eur = excluded.spent_eur, baseline_eur = excluded.baseline_eur,
           saving_promo_eur = excluded.saving_promo_eur, saving_store_eur = excluded.saving_store_eur, plan_ref = 'SEED'`,
        [uid, d.toISOString().slice(0, 10), +(base - promo - store).toFixed(2), base, promo, store]);
      n++;
    }
    // test user "signed up" before the first seeded week, so all weeks count
    await db.query(`update app_users set created_at = least(created_at, $2::date) where id = $1`,
      [uid, new Date(thisWeek.getTime() - 7 * 864e5 * (sample.length - 1)).toISOString().slice(0, 10)]);
    console.log(`seeded ${n} SEED weeks for ${email}`);
  }
  await closePool();
})().catch((e) => { console.error(e.message); process.exit(1); });
