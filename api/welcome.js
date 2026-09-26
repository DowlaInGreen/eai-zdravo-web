// GET /api/welcome?e=<base64url email>&s=<hmac> — Brevo DOI redirects here after the contact confirms.
// Sends the welcome email with the 2 free books (Brevo transactional API), then redirects to /hvala.
const { verify } = require('./_lib/token');
const html = require('./_lib/welcome-email');

module.exports = async function handler(req, res) {
  const site = process.env.SITE_URL || 'https://www.eai-zdravo.com';
  const go = () => { res.setHeader('Cache-Control', 'no-store'); res.writeHead(302, { Location: site + '/hvala' }); res.end(); };
  let email = '';
  try { email = Buffer.from(String(req.query.e || ''), 'base64url').toString('utf8').trim().toLowerCase(); } catch { return go(); }
  if (!verify(email, req.query.s)) { console.warn('welcome: bad signature'); return go(); }
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: 'E-AI zdravo', email: 'info@eai-zdravo.com' },
        replyTo: { name: 'E-AI zdravo', email: 'info@eai-zdravo.com' },
        to: [{ email }],
        subject: 'Tvoje 2 knjige su tu',
        htmlContent: html,
        tags: ['welcome', 'free-books'],
      }),
    });
    if (!r.ok) console.error('welcome: Brevo send error', r.status, await r.text());
  } catch (err) { console.error('welcome: network error', err); }
  return go();
};
