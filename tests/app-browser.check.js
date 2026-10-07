// Browser run of the whole app on the local stand-in server: real pages, real API
// handlers, local Postgres. Saves screenshots to $SHOTS (default ./out/shots).
// Google itself is replaced by a signed test session cookie (no network to Google here).
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'z'.repeat(40);
const { getPool, closePool } = require('../api/_lib/db');
const store = require('../api/_lib/store');
const session = require('../api/_lib/session');

const PORT = 8124;
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'out', 'shots');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
fs.mkdirSync(SHOTS, { recursive: true });
const log = (...a) => console.log(' ', ...a);
let failed = 0;
async function step(name, fn) {
  try { await fn(); console.log(`PASS  ${name}`); } catch (e) { failed++; console.log(`FAIL  ${name}\n      ${e.message.split('\n')[0]}`); }
}

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'app-server.js'), String(PORT)], { env: process.env, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((r) => server.stdout.once('data', r));
  await getPool().query('truncate app_users cascade');
  const user = await store.upsertGoogleUser({ sub: 'g-browser', email: 'vlado.test@example.com', name: 'Vlado Test' });
  const token = session.sign({ uid: user.id, exp: Date.now() + 3600e3 });

  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name, full = true) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full });

  await step('no session: /dashboard -> /prijava?next=/dashboard', async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForURL(/\/prijava/);
    assert.match(page.url(), /\/prijava\?next=%2Fdashboard/);
    assert.equal(await page.getAttribute('#go', 'href'), '/api/auth/google?next=%2Fdashboard');
    await shot('00-prijava-390');
  });

  await step('login error message shown (greska=istek)', async () => {
    await page.goto(`${BASE}/prijava?greska=istek`);
    assert.match(await page.textContent('#err'), /istekla/);
  });

  await ctx.addCookies([{ name: 'eai_session', value: token, url: BASE, httpOnly: true, sameSite: 'Lax' }]);

  await step('/onboarding/4 before step 1 -> sent back to /onboarding/1', async () => {
    await page.goto(`${BASE}/onboarding/4`);
    await page.waitForURL(/\/onboarding\/1$/);
  });

  await step('step 1: fields locked until consent; out-of-range weight shows error', async () => {
    assert.equal(await page.isDisabled('#weight_kg'), true);
    await page.click('#consent');
    assert.equal(await page.isDisabled('#weight_kg'), false);
    await page.fill('#birth_year', '1986'); await page.fill('#height_cm', '182'); await page.fill('#weight_kg', '400');
    await page.click('[data-act=next]');
    await page.waitForSelector('#weight_kg-err');
    log('error text:', await page.textContent('#weight_kg-err'));
    await page.fill('#weight_kg', '88');
    await shot('01-profil-390');
    await page.click('[data-act=next]');
    await page.waitForURL(/\/onboarding\/2$/);
  });

  await step('step 2: max 2 goals', async () => {
    await page.click('[data-k=save_money]'); await page.click('[data-k=less_time]');
    assert.equal(await page.isDisabled('[data-k=more_protein]'), true);
    await shot('02-cilj-390');
    await page.click('[data-act=next]');
    await page.waitForURL(/\/onboarding\/3$/);
  });

  await step('step 3: Da + mišićna masa + preporuka trenera (Uživo)', async () => {
    assert.equal(await page.isDisabled('[data-act=next]'), true);
    await page.click('[data-act=trains][data-k="1"]');
    await page.click('[data-k=build_muscle]');
    await page.click('[data-k=needs_ideas]'); await page.click('[data-k=online_challenges]');
    await page.click('[data-k=wants_trainer_referral]');
    assert.equal(await page.isDisabled('[data-act=next]'), true, 'mode required');
    await page.click('[data-act=tmode][data-k=in_person]');
    await shot('03-trening-390');
    await page.click('[data-act=next]');
    await page.waitForURL(/\/onboarding\/4$/);
  });

  await step('step 4: protein_150 preselected from training goal; refresh resumes at 4', async () => {
    await page.waitForSelector('[data-act=program]');
    assert.equal(await page.getAttribute('[data-k=protein_150]', 'aria-checked'), 'true');
    await page.reload();
    await page.waitForSelector('[data-act=program]');
    assert.match(page.url(), /\/onboarding\/4$/);
    await page.click('[data-k=old_school]'); await page.click('[data-k=lactose_free]'); await page.click('[data-k=vegan]');
    assert.ok(await page.isVisible('.note.warn'), 'conflict warning shown');
    await page.click('[data-k=vegan]');
    await shot('04-program-390');
    await page.click('[data-act=next]');
    await page.waitForURL(/\/onboarding\/5$/);
  });

  await step('step 5: allergens + dislikes', async () => {
    await page.click('[data-k=tree_nuts]');
    await page.fill('#dislikes', 'jetrica, gljive');
    await shot('05-alergeni-390');
    await page.click('[data-act=next]');
    await page.waitForURL(/\/onboarding\/6$/);
  });

  await step('step 6: 2 + 1 -> 2,5 porcije, 40/40/20, -> /dashboard', async () => {
    await page.click('[data-act=inc][data-k=adults]'); await page.click('[data-act=inc][data-k=children]');
    const txt = await page.textContent('.portion');
    log('portion card:', txt.replace(/\s+/g, ' ').trim());
    assert.match(txt, /2,5/); assert.match(txt, /40 % · 40 % · 20 %/);
    await shot('06-kucanstvo-390');
    await page.click('[data-act=next]');
    await page.waitForURL(/\/dashboard$/);
  });

  await step('dashboard, no weeks yet: 0,00 € and "Prvi plan stiže u nedjelju"', async () => {
    await page.waitForSelector('.savings');
    const s = await page.textContent('.savings');
    assert.match(s, /0,00\s€/); assert.match(s, /Prvi plan stiže u nedjelju/);
    await shot('07-dashboard-prazno-390');
  });

  await step('edit Ciljevi -> /onboarding/2?edit=1 -> save -> back on /dashboard', async () => {
    await page.click('a[href="/onboarding/2?edit=1"]');
    await page.waitForURL(/\/onboarding\/2\?edit=1$/);
    await page.click('[data-k=less_time]'); await page.click('[data-k=kid_friendly]');
    await page.click('[data-act=next]');
    await page.waitForURL(/\/dashboard$/);
    await page.waitForSelector('.cards');
    assert.match(await page.textContent('.cards'), /Hrana koju djeca jedu/);
  });

  await step('dev seed (6 weeks) -> savings panel shows weeks, month, year, total', async () => {
    const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'dev-seed-savings.js'), 'vlado.test@example.com'], { env: process.env }).toString().trim();
    log(out);
    await page.reload();
    await page.waitForSelector('.stat');
    const s = (await page.textContent('.savings')).replace(/\s+/g, ' ');
    log('panel:', s);
    assert.match(s, /prema planu/);
    await shot('08-dashboard-390');
    await page.setViewportSize({ width: 1280, height: 900 });
    await shot('09-dashboard-1280');
    await page.setViewportSize({ width: 390, height: 844 });
  });

  await step('no horizontal scroll at 390 px on all app pages', async () => {
    for (const u of ['/prijava', '/onboarding/3?edit=1', '/dashboard']) {
      await page.goto(BASE + u);
      await page.waitForTimeout(300);
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(w <= 390, `${u} scrollWidth ${w}`);
    }
  });

  await step('delete account -> back on /, session gone', async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.click('[data-act=delete]');
    await page.click('[data-act=confirm]');
    await page.waitForURL(`${BASE}/`);
    const r = await page.request.get(`${BASE}/api/me`);
    assert.equal(r.status(), 401);
  });

  await step('no JavaScript errors on any page', async () => { assert.deepEqual(errors, []); });

  await browser.close();
  server.kill();
  await closePool();
  console.log(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAIL`} · screenshots: ${SHOTS}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
