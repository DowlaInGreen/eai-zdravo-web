// All app DB access. Every function that touches user data takes userId as its
// first argument and filters by it — the browser never talks to Postgres.
const { getPool, withTx } = require('./db');

async function upsertGoogleUser({ sub, email, name, picture }) {
  return withTx(async (c) => {
    const { rows } = await c.query(
      `insert into app_users (google_sub, email, full_name, avatar_url)
       values ($1, $2, $3, $4)
       on conflict (google_sub) do update
         set email = excluded.email, full_name = excluded.full_name,
             avatar_url = excluded.avatar_url, last_login_at = now()
       returning id, email, full_name, created_at`,
      [sub, email, name || null, picture || null]
    );
    const user = rows[0];
    await c.query('insert into app_profiles (user_id) values ($1) on conflict do nothing', [user.id]);
    return user;
  });
}

async function getState(userId) {
  const db = getPool();
  const [u, p, t, h, l, s] = await Promise.all([
    db.query('select id, email, full_name, avatar_url, created_at from app_users where id = $1', [userId]),
    db.query(`select onboarding_step, onboarding_completed_at, birth_year, height_cm, weight_kg,
                     health_consent_at, goals from app_profiles where user_id = $1`, [userId]),
    db.query('select trains, training_goal, plan_status, trainer_mode from app_training where user_id = $1', [userId]),
    db.query(`select adults, children, program, plan_style, diets, allergens, dislikes, cook_days
              from app_households where user_id = $1`, [userId]),
    db.query(`select mode, status, created_at from app_trainer_leads
              where user_id = $1 order by created_at desc limit 1`, [userId]),
    db.query(`select to_char(week_start, 'YYYY-MM-DD') as week_start, spent_eur::float8 as spent_eur,
                     baseline_eur::float8 as baseline_eur, saving_promo_eur::float8 as saving_promo_eur,
                     saving_store_eur::float8 as saving_store_eur, source
              from app_weekly_savings where user_id = $1 order by week_start`, [userId]),
  ]);
  if (!u.rows[0]) return null;
  const profile = p.rows[0] || null;
  if (profile && profile.weight_kg !== null) profile.weight_kg = Number(profile.weight_kg);
  return {
    user: u.rows[0],
    profile,
    training: t.rows[0] || null,
    household: h.rows[0] || null,
    trainerLead: l.rows[0] || null,
    savingsRows: s.rows,
  };
}

// data = validated output of validateStep(step, ...)
async function saveStep(userId, step, data) {
  return withTx(async (c) => {
    if (step === 1) {
      await c.query(
        `update app_profiles set birth_year = $2, height_cm = $3, weight_kg = $4,
           health_consent_at = case when $5 then coalesce(health_consent_at, now()) else null end,
           updated_at = now()
         where user_id = $1`,
        [userId, data.birth_year, data.height_cm, data.weight_kg, data.consent]
      );
    } else if (step === 2) {
      await c.query('update app_profiles set goals = $2, updated_at = now() where user_id = $1', [userId, data.goals]);
    } else if (step === 3) {
      await c.query(
        `insert into app_training (user_id, trains, training_goal, plan_status, trainer_mode)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id) do update set trains = excluded.trains, training_goal = excluded.training_goal,
           plan_status = excluded.plan_status, trainer_mode = excluded.trainer_mode, updated_at = now()`,
        [userId, data.trains, data.training_goal, data.plan_status, data.trainer_mode]
      );
      if (data.trainer_mode) {
        await c.query(
          `insert into app_trainer_leads (user_id, mode) values ($1, $2)
           on conflict (user_id) where status in ('new','contacted') do update set mode = excluded.mode`,
          [userId, data.trainer_mode]
        );
      } else {
        await c.query(`update app_trainer_leads set status = 'closed' where user_id = $1 and status = 'new'`, [userId]);
      }
    } else if (step === 4 || step === 5 || step === 6) {
      await c.query('insert into app_households (user_id) values ($1) on conflict do nothing', [userId]);
      if (step === 4) {
        await c.query('update app_households set program = $2, diets = $3, updated_at = now() where user_id = $1',
          [userId, data.program, data.diets]);
      } else if (step === 5) {
        await c.query('update app_households set allergens = $2, dislikes = $3, updated_at = now() where user_id = $1',
          [userId, data.allergens, data.dislikes]);
      } else {
        await c.query('update app_households set adults = $2, children = $3, updated_at = now() where user_id = $1',
          [userId, data.adults, data.children]);
      }
    } else {
      throw new Error('bad step');
    }
    // napredak: nikad unatrag; korak 6 zaključuje onboarding
    await c.query(
      `update app_profiles set
         onboarding_step = greatest(onboarding_step, $2),
         onboarding_completed_at = case when $2 >= 7 then coalesce(onboarding_completed_at, now())
                                        else onboarding_completed_at end
       where user_id = $1`,
      [userId, step + 1]
    );
  });
}

// "Obriši moje podatke": briše cijeli račun (cascade na sve app_* tablice).
async function deleteUser(userId) {
  const { rowCount } = await getPool().query('delete from app_users where id = $1', [userId]);
  return rowCount;
}

module.exports = { upsertGoogleUser, getState, saveStep, deleteUser };
