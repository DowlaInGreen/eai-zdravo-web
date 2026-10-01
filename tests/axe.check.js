// L1-#13: axe-core WCAG2AA check. @axe-core/cli tries to reach
// googlechromelabs.github.io to resolve a Chrome build, which this session's
// network policy blocks — so axe-core is run directly against the pinned
// Chrome via Playwright instead. Same engine, same ruleset, no CLI wrapper.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const pages = ['/', '/founder', '/prehrana', '/trening'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  let seriousOrCritical = 0;
  for (const p of pages) {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8123' + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // let entrance animations (data-hero, data-reveal) settle before measuring contrast
    await page.evaluate(axeSource);
    const results = await page.evaluate(async () => {
      return await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    });
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    seriousOrCritical += bad.length;
    console.log(`\n=== ${p} ===`);
    console.log('violations (all):', results.violations.length, '| serious/critical:', bad.length);
    for (const v of results.violations) {
      console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
    }
    await page.close();
  }
  await browser.close();
  console.log('\nTOTAL serious/critical violations:', seriousOrCritical);
  process.exit(seriousOrCritical > 0 ? 1 : 0);
})();
