// Local stand-in for Vercel: static files (cleanUrls + the vercel.json rewrite)
// plus api/*.js handlers. For screenshots and browser tests only.
//   POSTGRES_URL=... SESSION_SECRET=... node tests/app-server.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = Number(process.argv[2] || 8124);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.json': 'application/json' };

function apiHandler(p) {
  const file = path.join(root, `${p}.js`);
  if (!file.startsWith(path.join(root, 'api')) || p.includes('/_') || !fs.existsSync(file)) return null;
  return require(file);
}

http.createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.startsWith('/api/')) {
    const h = apiHandler(p);
    if (!h) { res.statusCode = 404; return res.end('not found'); }
    try { return await h(req, res); } catch (e) { console.error(e); res.statusCode = 500; return res.end('error'); }
  }
  if (/^\/onboarding\/\d$/.test(p)) p = '/onboarding';
  if (p === '/') p = '/index.html';
  let full = path.join(root, p);
  if (!fs.existsSync(full) && !path.extname(p)) full = path.join(root, `${p}.html`);
  if (!full.startsWith(root) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.statusCode = 404; return res.end('404'); }
  res.writeHead(200, { 'content-type': types[path.extname(full)] || 'application/octet-stream' });
  fs.createReadStream(full).pipe(res);
}).listen(port, () => console.log(`app-server on :${port}`));
