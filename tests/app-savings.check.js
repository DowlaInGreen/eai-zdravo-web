// O1.4 — computeSavings(rows, signupDate, today). Pure function, no DB.
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeSavings } = require('../api/_lib/savings');

const row = (week_start, baseline_eur, saving, extra = {}) => ({
  week_start, baseline_eur, spent_eur: baseline_eur - saving,
  saving_promo_eur: saving, saving_store_eur: 0, source: 'plan', ...extra,
});
const TODAY = new Date('2026-10-14T10:00:00+02:00');      // Wednesday, week of 12.10.
const SIGNUP = new Date('2026-09-01T09:00:00+02:00');

test('1. no rows -> all zeros, pct null', () => {
  const s = computeSavings([], SIGNUP, TODAY);
  for (const k of ['week', 'month', 'year', 'total']) {
    assert.equal(s[k].saving, 0, k);
    assert.equal(s[k].pct, null, k);
    assert.equal(s[k].weeks, 0, k);
  }
  assert.equal(s.empty, true);
});

test('2. two weeks same month: 5/25 + 3/15 -> 8,00 € and 20,0 % (not average of %)', () => {
  const s = computeSavings([row('2026-10-05', 25, 5), row('2026-10-12', 15, 3)], SIGNUP, TODAY);
  assert.equal(s.month.saving, 8);
  assert.equal(s.month.pct, 0.2);
  assert.equal(s.week.saving, 3);
  assert.equal(s.week.pct, 0.2);
  assert.equal(s.empty, false);
});

test('3. year boundary: week of 29.12.2025 not in 2026 YTD, but in total', () => {
  const signup = new Date('2025-12-20T12:00:00+01:00');
  const today = new Date('2026-01-07T12:00:00+01:00');
  const s = computeSavings([row('2025-12-29', 20, 4), row('2026-01-05', 30, 6)], signup, today);
  assert.equal(s.year.saving, 6);
  assert.equal(s.year.weeks, 1);
  assert.equal(s.total.saving, 10);
  assert.equal(s.month.saving, 6);
});

test('4. signup 15.07.2026: week 06.07 excluded everywhere, 13.07 included; YTD starts 13.07', () => {
  const signup = new Date('2026-07-15T18:00:00+02:00');
  const today = new Date('2026-07-20T09:00:00+02:00');
  const s = computeSavings([row('2026-07-06', 20, 9), row('2026-07-13', 20, 2), row('2026-07-20', 10, 1)], signup, today);
  assert.equal(s.year.saving, 3);
  assert.equal(s.total.saving, 3);
  assert.equal(s.month.saving, 3);
  assert.equal(s.week.saving, 1);
  assert.equal(s.yearStart, '2026-07-13');
});

test('5. baseline 0 -> no division by zero; pct null when total baseline is 0', () => {
  const s = computeSavings([row('2026-10-12', 0, 0)], SIGNUP, TODAY);
  assert.equal(s.week.pct, null);
  assert.equal(s.week.saving, 0);
  const s2 = computeSavings([row('2026-10-05', 0, 0), row('2026-10-12', 10, 1)], SIGNUP, TODAY);
  assert.equal(s2.month.pct, 0.1);
});

test('6. time zone: 2026-10-05 00:30 Europe/Zagreb is in week of 05.10, not the previous week', () => {
  const today = new Date('2026-10-04T22:30:00Z');  // = 05.10. 00:30 in Zagreb (UTC+2)
  const s = computeSavings([row('2026-09-28', 10, 1), row('2026-10-05', 10, 2)], SIGNUP, today);
  assert.equal(s.week.saving, 2);
  assert.equal(s.weekStart, '2026-10-05');
});

test('future weeks are not counted', () => {
  const s = computeSavings([row('2026-10-19', 10, 5)], SIGNUP, TODAY);
  assert.equal(s.total.saving, 0);
});

test('promo/store split and "prema planu" flag', () => {
  const s = computeSavings([
    row('2026-10-12', 50, 0, { saving_promo_eur: 6.4, saving_store_eur: 2.1, spent_eur: 41.5 }),
    row('2026-10-05', 40, 3, { source: 'confirmed' }),
  ], SIGNUP, TODAY);
  assert.equal(s.week.promo, 6.4);
  assert.equal(s.week.store, 2.1);
  assert.equal(s.week.saving, 8.5);
  assert.equal(s.week.fromPlan, true);
  assert.equal(s.month.fromPlan, true, 'any plan row in the window -> note "prema planu"');
  const confirmedOnly = computeSavings([row('2026-10-12', 40, 3, { source: 'confirmed' })], SIGNUP, TODAY);
  assert.equal(confirmedOnly.week.fromPlan, false);
});

test('cents are rounded, not floating noise', () => {
  const s = computeSavings([row('2026-10-05', 10, 0.1), row('2026-10-12', 10, 0.2)], SIGNUP, TODAY);
  assert.equal(s.month.saving, 0.3);
});
