// Minimal static file server that mimics Vercel's cleanUrls:true (vercel.json)
// for local Playwright/Lighthouse/axe runs, since this session's network
// policy blocks outbound access to eai-zdravo.com and *.vercel.app (see PLAN.md).
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml',
  '.txt': 'text/plain', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json' };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  let full = path.join(root, p);
  if (!fs.existsSync(full) && !path.extname(p)) full = path.join(root, p + '.html');
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    const notFound = path.join(root, '404.html');
    res.writeHead(404, { 'content-type': 'text/html' });
    return fs.createReadStream(notFound).pipe(res);
  }
  res.writeHead(200, { 'content-type': types[path.extname(full)] || 'application/octet-stream' });
  fs.createReadStream(full).pipe(res);
}).listen(8123, () => console.log('static-server on :8123'));
