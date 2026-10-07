// DELETE /api/account — "Obriši moje podatke": removes the whole account and
// everything linked to it (cascade), then signs out.
const { requireUser } = require('./_lib/guard');
const store = require('./_lib/store');
const session = require('./_lib/session');
const oauth = require('./_lib/oauth');
const { json, sameOriginJson } = require('./_lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') { res.setHeader('Allow', 'DELETE'); return json(res, 405, { error: 'Method not allowed' }); }
  if (!sameOriginJson(req, oauth.baseUrl(req))) return json(res, 403, { error: 'Zabranjeno.' });
  const uid = requireUser(req, res);
  if (!uid) return;
  await store.deleteUser(uid);
  session.clearSession(req, res);
  return json(res, 200, { ok: true, next: '/' });
};
