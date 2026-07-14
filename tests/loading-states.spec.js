const { test, expect } = require('@playwright/test');

// R3 — the schedule shows a loading skeleton until the data is rendered, and
// the "no routines" empty state is never shown before the data has loaded.
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html' },
];

test.describe('loading skeleton (before scripts render the schedule)', () => {
  // Verify the property directly against the server-delivered HTML rather
  // than racing to catch a live mid-parse browser state (fragile: it depends
  // on the relative timing of the CSS and JS network requests). The skeleton
  // markup shipping in the raw HTML — with no pre-rendered .routine-card
  // elements — is exactly what guarantees a visitor sees it immediately, with
  // no flash of empty content, before schedule-engine.js has even started.
  // (Previously this test used javaScriptEnabled:false to freeze the page in
  // its pre-script state, but that now means "JS never runs at all," which is
  // the W3.1 no-JS-fallback scenario covered by tests/noscript-fallback.spec.js
  // — a stuck-forever skeleton would be wrong there, since the real schedule
  // renders statically instead.)
  for (const { name, path } of PAGES) {
    test(`${name}: skeleton ships in the initial HTML, with no pre-rendered cards`, async ({ page }) => {
      const res = await page.request.get(path);
      const html = await res.text();
      expect(html).toContain('id="schedule-skeleton"');
      expect(html).not.toContain('class="routine-card');
      expect(html).not.toMatch(/id="no-results"[^>]*class="[^"]*is-visible/);
    });
  }
});

test.describe('schedule render replaces the skeleton', () => {
  for (const { name, path } of PAGES) {
    test(`${name}: skeleton is removed and routines are rendered`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#schedule-skeleton')).toHaveCount(0);
      expect(await page.locator('.routine-card').count()).toBeGreaterThan(0);
      await expect(page.locator('#no-results')).toBeHidden();
    });
  }
});
