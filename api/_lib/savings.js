// Savings windows for the dashboard. Pure: rows in, numbers out.
// Rules (uputa O1.4):
//  - saving = Σ(promo + store); pct = saving / Σ baseline over the same rows (never avg of %).
//  - A row belongs to a window by week_start (ISO Monday). Rows before the signup week
//    and weeks that have not started yet are ignored everywhere.
//  - Windows in Europe/Zagreb: week = current ISO week, month = calendar month to date,
//    year = 1 Jan (or signup week if later) to date, total = since signup week.
const TZ = 'Europe/Zagreb';

function zagrebDate(d) {
  // YYYY-MM-DD of instant d in Zagreb
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function mondayOf(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

const cents = (x) => Math.round(x * 100) / 100;
const num = (x) => (x === null || x === undefined ? 0 : Number(x));

function sum(rows, from, to) {
  const inWin = rows.filter((r) => r.week_start >= from && r.week_start <= to);
  const t = inWin.reduce((a, r) => ({
    baseline: a.baseline + num(r.baseline_eur),
    spent: a.spent + num(r.spent_eur),
    promo: a.promo + num(r.saving_promo_eur),
    store: a.store + num(r.saving_store_eur),
  }), { baseline: 0, spent: 0, promo: 0, store: 0 });
  const saving = cents(t.promo + t.store);
  const baseline = cents(t.baseline);
  return {
    saving,
    promo: cents(t.promo),
    store: cents(t.store),
    baseline,
    spent: cents(t.spent),
    pct: baseline > 0 ? Math.round((saving / baseline) * 10000) / 10000 : null,
    weeks: inWin.length,
    fromPlan: inWin.some((r) => r.source !== 'confirmed'),   // UI note "prema planu"
    from,
  };
}

function computeSavings(rows, signupDate, today = new Date()) {
  const todayYmd = zagrebDate(new Date(today));
  const signupWeek = mondayOf(zagrebDate(new Date(signupDate)));
  const weekStart = mondayOf(todayYmd);
  const monthStart = `${todayYmd.slice(0, 7)}-01`;
  const yearStart = `${todayYmd.slice(0, 4)}-01-01`;
  const max = (a, b) => (a > b ? a : b);
  const valid = (rows || []).filter((r) => r && typeof r.week_start === 'string');

  const out = {
    today: todayYmd,
    signupWeek,
    weekStart,
    monthStart: max(monthStart, signupWeek),
    yearStart: max(yearStart, signupWeek),
    week: sum(valid, max(weekStart, signupWeek), todayYmd),
    month: sum(valid, max(monthStart, signupWeek), todayYmd),
    year: sum(valid, max(yearStart, signupWeek), todayYmd),
    total: sum(valid, signupWeek, todayYmd),
  };
  out.empty = out.total.weeks === 0;
  return out;
}

module.exports = { computeSavings, zagrebDate, mondayOf };
