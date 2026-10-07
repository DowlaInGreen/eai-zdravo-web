// Fake req/res for calling Vercel-style handlers in-process.
const { Readable } = require('stream');

function makeReq({ method = 'GET', url = '/', headers = {}, body } = {}) {
  const raw = body === undefined ? '' : (typeof body === 'string' ? body : JSON.stringify(body));
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost:3000', ...headers };
  return req;
}

function makeRes() {
  const headers = {};
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const res = {
    statusCode: 200,
    body: '',
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    getHeader(k) { return headers[k.toLowerCase()]; },
    end(chunk) { if (chunk) this.body += chunk; resolve(); },
    headers,
    done,
    get json() { return JSON.parse(this.body); },
    get cookies() {
      const sc = headers['set-cookie'];
      return sc ? (Array.isArray(sc) ? sc : [sc]) : [];
    },
  };
  return res;
}

async function call(handler, reqOpts) {
  const req = makeReq(reqOpts);
  const res = makeRes();
  await handler(req, res);
  return res;
}

// "name=value" pairs from Set-Cookie headers, for the next request
function cookieHeader(res, extra = '') {
  const pairs = res.cookies.map((c) => c.split(';')[0]).filter((p) => !p.endsWith('='));
  return [extra, ...pairs].filter(Boolean).join('; ');
}

module.exports = { makeReq, makeRes, call, cookieHeader };
