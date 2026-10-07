// POST /api/onboarding  { step: 1..6, data: {...}, edit?: true }
// Validates and saves one step for the signed-in user.
const { requireUser } = require('./_lib/guard');
const store = require('./_lib/store');
const oauth = require('./_lib/oauth');
const { validateStep } = require('./_lib/onboarding');
const { json, body, sameOriginJson } = require('./_lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed' }); }
  if (!sameOriginJson(req, oauth.baseUrl(req))) return json(res, 403, { error: 'Zabranjeno.' });
  const uid = requireUser(req, res);
  if (!uid) return;

  const input = await body(req);
  const step = Number(input && input.step);
  if (!Number.isInteger(step) || step < 1 || step > 6) return json(res, 400, { error: 'Nepoznat korak.' });

  const state = await store.getState(uid);
  if (!state) return json(res, 401, { error: 'Prijavi se.', login: '/prijava' });
  // ne može se preskočiti korak koji još nije na redu
  if (step > state.profile.onboarding_step) return json(res, 409, { error: 'Prvo završi prethodne korake.', step: state.profile.onboarding_step });

  const v = validateStep(step, input.data);
  if (!v.ok) return json(res, 400, { error: 'Provjeri označena polja.', errors: v.errors });

  await store.saveStep(uid, step, v.data);
  const editing = input.edit === true && Boolean(state.profile.onboarding_completed_at);
  const next = editing || step === 6 ? '/dashboard' : `/onboarding/${step + 1}`;
  return json(res, 200, { ok: true, next, warnings: v.warnings });
};
