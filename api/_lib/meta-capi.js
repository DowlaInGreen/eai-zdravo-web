// Meta Conversions API — server-side Lead, radi i kad ad-blocker blokira pixel u pregledniku.
// Env (Vercel → Settings → Environment Variables; vrijednost upisuje vlasnik, nikad u kod):
//   META_CAPI_TOKEN        access token iz Events Manager → dataset → Postavke → Conversions API
//   META_PIXEL_ID          optional, default 1608983517302133
//   META_TEST_EVENT_CODE   optional, samo za testiranje (Events Manager → Test events)
//   META_GRAPH_VERSION     optional, default v22.0
// Bez META_CAPI_TOKEN funkcija ne radi ništa. Šalje se SAMO ako je posjetitelj prihvatio kolačiće.

const crypto = require('crypto');

const sha256 = (v) => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');

function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.headers['x-real-ip'] || undefined;
}

async function sendLead(req, { email, eventId, sourceUrl, fbp, fbc, paket }) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return { skipped: 'no_token' };

  const pixel = process.env.META_PIXEL_ID || '1608983517302133';
  const version = process.env.META_GRAPH_VERSION || 'v22.0';

  const user_data = {
    em: [sha256(email)],
    client_ip_address: clientIp(req),
    client_user_agent: String(req.headers['user-agent'] || '').slice(0, 500) || undefined,
    fbp: fbp || undefined,
    fbc: fbc || undefined,
  };
  Object.keys(user_data).forEach((k) => user_data[k] === undefined && delete user_data[k]);

  const payload = {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId || undefined, // isti ID kao pixel → Meta deduplicira
      action_source: 'website',
      event_source_url: sourceUrl || undefined,
      user_data,
      custom_data: { content_name: paket },
    }],
  };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(`https://graph.facebook.com/${version}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!r.ok) console.error('capi: Meta error', r.status, (await r.text()).slice(0, 300));
    return { ok: r.ok, status: r.status };
  } catch (err) {
    console.error('capi: network error', err && err.name);
    return { ok: false };
  } finally {
    clearTimeout(t);
  }
}

module.exports = { sendLead, sha256 };
