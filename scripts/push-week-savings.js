// O1.5 — pipeline hook: push one or more weekly savings totals (from the S3 report
// math in the local pipeline) into app_weekly_savings. The web app never computes
// basket savings itself; it only adds these rows up.
//
//   node scripts/push-week-savings.js week.json [--dry-run]
//
// week.json = one object or an array of objects:
//   { "email": "user@example.com", "week_start": "2026-10-05",
//     "spent_eur": 41.20, "baseline_eur": 49.60,
//     "saving_promo_eur": 6.10, "saving_store_eur": 2.30,
//     "source": "plan", "plan_ref": "plan-2026-10-05-abc" }
// Env: POSTGRES_URL (load with: vercel env pull .env.app --environment=production; never print it).
const fs = require('fs');
const { getPool, closePool } = require('../api/_lib/db');

const [file, ...flags] = process.argv.slice(2);
const dry = flags.includes('--dry-run');
if (!file) { console.error('usage: node scripts/push-week-savings.js <week.json> [--dry-run]'); process.exit(1); }

function check(w, i) {
  const errs = [];
  if (!w.email || !/^[^@\s]+@[^@\s]+$/.test(w.email)) errs.push('email');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w.week_start || '') || new Date(`${w.week_start}T00:00:00Z`).getUTCDay() !== 1) errs.push('week_start must be a Monday (YYYY-MM-DD)');
  for (const k of ['spent_eur', 'baseline_eur', 'saving_promo_eur', 'saving_store_eur']) {
    if (typeof w[k] !== 'number' || !(w[k] >= 0)) errs.push(`${k} >= 0`);
  }
  if (w.source && !['plan', 'confirmed'].includes(w.source)) errs.push('source plan|confirmed');
  if (errs.length) throw new Error(`row ${i}: ${errs.join(', ')}`);
  const gap = Math.abs(w.baseline_eur - w.spent_eur - (w.saving_promo_eur + w.saving_store_eur));
  if (gap > 0.05) console.warn(`WARN row ${i} (${w.email} ${w.week_start}): baseline − spent differs from promo + store by ${gap.toFixed(2)} €`);
}

(async () => {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const weeks = Array.isArray(raw) ? raw : [raw];
  weeks.forEach(check);
  let ok = 0; let missing = 0;
  for (const w of weeks) {
    const u = await getPool().query('select id from app_users where email = $1', [w.email.toLowerCase()]);
    if (!u.rows[0]) { console.warn(`SKIP ${w.email}: no app account`); missing++; continue; }
    if (dry) { console.log(`DRY  ${w.email} ${w.week_start} saving ${(w.saving_promo_eur + w.saving_store_eur).toFixed(2)} €`); ok++; continue; }
    await getPool().query(
      `insert into app_weekly_savings (user_id, week_start, spent_eur, baseline_eur, saving_promo_eur, saving_store_eur, source, plan_ref)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (user_id, week_start) do update set spent_eur = excluded.spent_eur, baseline_eur = excluded.baseline_eur,
         saving_promo_eur = excluded.saving_promo_eur, saving_store_eur = excluded.saving_store_eur,
         source = excluded.source, plan_ref = excluded.plan_ref`,
      [u.rows[0].id, w.week_start, w.spent_eur, w.baseline_eur, w.saving_promo_eur, w.saving_store_eur, w.source || 'plan', w.plan_ref || null]);
    console.log(`OK   ${w.email} ${w.week_start} saving ${(w.saving_promo_eur + w.saving_store_eur).toFixed(2)} €`);
    ok++;
  }
  console.log(`${dry ? 'dry-run: would write' : 'done:'} ${ok}${dry ? '' : ' written'}, ${missing} skipped`);
  await closePool();
})().catch((e) => { console.error(`FAIL ${e.message}`); process.exit(1); });
