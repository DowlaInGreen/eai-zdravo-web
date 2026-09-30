import { test, expect } from '@playwright/test';

// L1-#17: form validation proof. Client-side checks (empty email, invalid email,
// missing consent) never call the network — asserted directly, no mock needed.
// The double-submit case mocks /api/subscribe (no real Brevo call from this
// sandbox) and counts requests to prove the disabled-button guard dedupes.

test('prazan email — odbijeno, poruka na hrvatskom', async ({ page }) => {
  await page.goto('/');
  await page.click('.eai-cc .n'); // dismiss consent banner, out of the way
  await page.fill('#f-name', 'Test');
  await page.check('#f-consent');
  await page.click('#signup button[type=submit]');
  await expect(page.locator('#form-msg')).toHaveText('Upiši ispravnu email adresu.');
});

test('nevaljan email "abc@" — odbijeno', async ({ page }) => {
  await page.goto('/');
  await page.click('.eai-cc .n');
  await page.fill('#f-email', 'abc@');
  await page.check('#f-consent');
  await page.click('#signup button[type=submit]');
  await expect(page.locator('#form-msg')).toHaveText('Upiši ispravnu email adresu.');
});

test('bez checkboxa privole — odbijeno', async ({ page }) => {
  await page.goto('/');
  await page.click('.eai-cc .n');
  await page.fill('#f-email', 'test@example.com');
  await page.click('#signup button[type=submit]');
  await expect(page.locator('#form-msg')).toHaveText('Za slanje knjiga trebamo tvoju privolu.');
});

test('dvoklik na submit — samo jedan POST (gumb disabled dok traje)', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/subscribe', async (route) => {
    calls++;
    await new Promise((r) => setTimeout(r, 300)); // hold the request open so a second click would race it
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/');
  await page.click('.eai-cc .n');
  await page.fill('#f-email', 'test@example.com');
  await page.check('#f-consent');
  const btn = page.locator('#signup button[type=submit]');
  await Promise.all([btn.click(), btn.click({ force: true })]);
  await page.waitForTimeout(500);
  expect(calls).toBe(1);
});
