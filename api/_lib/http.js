// Tiny response helpers that work on Vercel and on the local test server.
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

function query(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  return Object.fromEntries(new URL(req.url, 'http://x').searchParams);
}

async function body(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return null; } }
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 16384) return null; chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return null; }
}

// State-changing JSON endpoints: JSON content type (blocks plain cross-site
// form posts) + Origin, when sent, must be one of ours.
function sameOriginJson(req, base) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.startsWith('application/json')) return false;
  const origin = req.headers.origin;
  return !origin || (base && origin === base);
}

module.exports = { json, redirect, query, body, sameOriginJson };
