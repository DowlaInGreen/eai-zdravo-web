// GET /api/me — everything the onboarding and dashboard pages need, for the
// signed-in user only.
const { requireUser } = require('./_lib/guard');
const store = require('./_lib/store');
const session = require('./_lib/session');
const { json } = require('./_lib/http');
const { computeSavings } = require('./_lib/savings');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(res, 405, { error: 'Method not allowed' }); }
  const uid = requireUser(req, res);
  if (!uid) return;
  const state = await store.getState(uid);
  if (!state) { session.clearSession(req, res); return json(res, 401, { error: 'Prijavi se.', login: '/prijava' }); }
  const { savingsRows, ...rest } = state;
  return json(res, 200, {
    ...rest,
    savings: computeSavings(savingsRows, state.user.created_at, new Date()),
  });
};
