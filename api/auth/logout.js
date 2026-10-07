// GET|POST /api/auth/logout — clears the session cookie.
const session = require('../_lib/session');
const { redirect } = require('../_lib/http');

module.exports = async function handler(req, res) {
  session.clearSession(req, res);
  return redirect(res, '/');
};
