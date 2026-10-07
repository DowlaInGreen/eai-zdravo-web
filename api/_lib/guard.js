// Shared guard for app endpoints: env present + valid session.
const session = require('./session');
const { json } = require('./http');

function appReady() {
  return Boolean(process.env.POSTGRES_URL && session.secret());
}

// Returns userId or writes the error response and returns null.
function requireUser(req, res) {
  if (!appReady()) { json(res, 503, { error: 'Aplikacija se otvara uskoro.' }); return null; }
  const uid = session.sessionUserId(req);
  if (!uid) { json(res, 401, { error: 'Prijavi se.', login: '/prijava' }); return null; }
  return uid;
}

module.exports = { requireUser, appReady };
