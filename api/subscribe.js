// POST /api/subscribe — adds a contact to Brevo with double opt-in (GDPR proof of consent).
// Env (set in Vercel → Project → Settings → Environment Variables, never in code):
//   BREVO_API_KEY            required
//   BREVO_DOI_TEMPLATE_ID    required — Brevo template with the {{ doubleoptin }} confirm link
//   BREVO_LIST_BESPLATNO     required — list id (number)
//   BREVO_LIST_PODRZAVATELJ, BREVO_LIST_OSNIVAC, BREVO_LIST_FITNESS, BREVO_LIST_ZDRAVLJE  optional; fall back to BESPLATNO
//   SITE_URL                 optional, default https://eai-zdravo.com

const PAKETI = ['besplatno', 'podrzavatelj', 'osnivac', 'fitness', 'zdravlje'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function listFor(paket) {
  const base = Number(process.env.BREVO_LIST_BESPLATNO);
  const specific = Number(process.env['BREVO_LIST_' + paket.toUpperCase()]);
  const ids = [specific || base].filter(Boolean);
  return [...new Set(ids)];
}

async function brevoDoi(body) {
  const r = await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let data = req.body;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = {}; } }
  data = data || {};

  // Honeypot: bots fill hidden "website" field. Pretend success.
  if (data.website) return res.status(200).json({ ok: true });

  const email = String(data.email || '').trim().toLowerCase().slice(0, 254);
  const name = String(data.name || '').trim().slice(0, 80);
  const paket = PAKETI.includes(data.paket) ? data.paket : 'besplatno';

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Upiši ispravnu email adresu.' });
  if (data.consent !== true) return res.status(400).json({ error: 'Za slanje knjiga trebamo tvoju privolu.' });

  if (!process.env.BREVO_API_KEY || !process.env.BREVO_DOI_TEMPLATE_ID || !process.env.BREVO_LIST_BESPLATNO) {
    console.error('subscribe: Brevo env vars missing');
    return res.status(503).json({ error: 'Prijave se otvaraju uskoro. Do tada nam piši na info@eai-zdravo.com.' });
  }

  const site = process.env.SITE_URL || 'https://eai-zdravo.com';
  const attributes = {
    FIRSTNAME: name || undefined,
    PAKET: paket,
    IZVOR: String(data.utm_source || 'web').slice(0, 60),
    KAMPANJA: String(data.utm_campaign || '').slice(0, 60) || undefined,
    PRIVOLA_DATUM: new Date().toISOString().slice(0, 10),
  };
  Object.keys(attributes).forEach((k) => attributes[k] === undefined && delete attributes[k]);

  const body = {
    email,
    attributes,
    includeListIds: listFor(paket),
    templateId: Number(process.env.BREVO_DOI_TEMPLATE_ID),
    redirectionUrl: site + '/hvala',
  };

  try {
    let r = await brevoDoi(body);
    // If custom attributes are not created in Brevo yet, retry with the standard one only.
    if (!r.ok && r.status === 400 && /attribute/i.test(r.text)) {
      console.warn('subscribe: retrying without custom attributes:', r.text);
      r = await brevoDoi({ ...body, attributes: name ? { FIRSTNAME: name } : {} });
    }
    if (!r.ok) {
      console.error('subscribe: Brevo error', r.status, r.text);
      return res.status(502).json({ error: 'Prijava trenutno ne prolazi. Pokušaj za minutu ili piši na info@eai-zdravo.com.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('subscribe: network error', err);
    return res.status(502).json({ error: 'Prijava trenutno ne prolazi. Pokušaj za minutu.' });
  }
};
