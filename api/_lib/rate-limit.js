// In-memory rate limit for /api/subscribe. Starting point per L1-#18 — Vercel
// serverless instances are not guaranteed to be warm/shared across requests,
// so this throttles bursts on a warm instance but is not a hard global cap.
// Move to Vercel KV if abuse shows it's needed (see PLAN.md).

const WINDOW_MS = 10 * 60 * 1000; // 10 min
const MAX_PER_WINDOW = 5;
const hits = new Map(); // ip -> timestamps[]

function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.headers['x-real-ip'] || 'unknown';
}

// Returns true if the request should be allowed, false if it's over the limit.
function allow(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) { hits.set(ip, recent); return false; }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

module.exports = { allow, clientIp };
