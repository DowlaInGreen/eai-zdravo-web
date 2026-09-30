import { test, expect } from '@playwright/test';

// L1-#5: cookie consent proof. Runs against a local static server (see
// playwright.config.ts) because this session has no outbound network access
// to eai-zdravo.com / *.vercel.app. Meta-domain requests are asserted by
// *initiation* (page.on('request')), which Playwright observes even when the
// request itself is later blocked or fails — that is enough to prove whether
// the site attempted to load the pixel, independent of whether it reaches
// facebook.net from this sandbox.

const META_HOSTS = ['connect.facebook.net', 'facebook.com'];
const isMetaRequest = (url: string) => META_HOSTS.some((h) => url.includes(h));

test('nijedan Meta request prije klika', async ({ page }) => {
  const metaRequests: string[] = [];
  page.on('request', (r) => { if (isMetaRequest(r.url())) metaRequests.push(r.url()); });

  await page.goto('/');
  await page.waitForSelector('.eai-cc', { timeout: 5000 });
  expect(metaRequests, 'nijedan Meta request prije interakcije s bannerom').toEqual([]);
});

test('klik "Odbij" — i dalje nula Meta requestova, banner se ne vraća, Pixel se ne učitava', async ({ page }) => {
  const metaRequests: string[] = [];
  page.on('request', (r) => { if (isMetaRequest(r.url())) metaRequests.push(r.url()); });

  await page.goto('/');
  await page.waitForSelector('.eai-cc');
  await page.click('.eai-cc .n');
  await page.waitForTimeout(300);
  expect(metaRequests, 'nula Meta requestova nakon Odbij').toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('eai_consent'))).toBe('no');

  await page.reload();
  await page.waitForTimeout(300);
  await expect(page.locator('.eai-cc')).toHaveCount(0);
  expect(await page.evaluate(() => !!(window as any).fbq)).toBe(false);
  expect(metaRequests, 'nula Meta requestova nakon reload').toEqual([]);
});

test('klik "Prihvati" — fbevents.js se pokušava učitati', async ({ page }) => {
  const metaRequests: string[] = [];
  page.on('request', (r) => { if (isMetaRequest(r.url())) metaRequests.push(r.url()); });

  await page.goto('/');
  await page.waitForSelector('.eai-cc');
  await page.click('.eai-cc .y');
  await page.waitForTimeout(500);

  expect(metaRequests.some((u) => u.includes('fbevents.js'))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('eai_consent'))).toBe('yes');
});

test('"Postavke kolačića" na /privatnost ponovno otvara banner', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.eai-cc');
  await page.click('.eai-cc .y');
  await page.waitForTimeout(200);

  await page.goto('/privatnost');
  await expect(page.locator('.eai-cc')).toHaveCount(0);
  await page.click('[data-consent-reset]');
  await expect(page.locator('.eai-cc')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('eai_consent'))).toBeNull();
});
