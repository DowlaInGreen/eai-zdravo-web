import { defineConfig } from '@playwright/test';

// L1: no outbound network access to eai-zdravo.com/*.vercel.app from this session
// (org egress policy, see PLAN.md). Tests run against a local static server
// serving the same repo root Vercel deploys from cleanUrls handles /founder etc.
// via the dev server rewrite below.
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:8123',
    headless: true,
    launchOptions: {
      // pinned @playwright/test version differs from the pre-installed browser
      // revision in /opt/pw-browsers; use the full Chrome binary that IS there
      // instead of downloading (session has no route to the Playwright CDN).
      executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    },
  },
  webServer: {
    command: 'node tests/static-server.js',
    port: 8123,
    reuseExistingServer: true,
    timeout: 10000,
  },
});
