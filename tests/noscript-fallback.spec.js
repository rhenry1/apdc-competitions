const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { buildForFile } = require('../scripts/build-noscript.js');

// W3.1 — the core schedule must render even if JS fails entirely (the site's
// own working agreement). nationals-2026 and regionals-spring-2027 ship a
// <noscript> fallback generated straight from each page's SCHEDULE data, so
// it can never drift from what the interactive engine renders.
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html', file: 'nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html', file: 'regionals-spring-2027/index.html' },
];

test.describe('no-JS fallback: generator stays in sync with SCHEDULE', () => {
  for (const { name, file } of PAGES) {
    test(`${name}: committed <noscript> block matches the generator's output`, () => {
      const full = path.resolve(__dirname, '..', file);
      const changed = buildForFile(full, { check: true });
      expect(changed, `${file} is stale — run: node scripts/build-noscript.js`).toBe(false);
    });
  }
});

test.describe('no-JS fallback: rendered behavior with JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('nationals-2026 shows the real schedule and hides JS-only chrome', async ({ page }) => {
    await page.goto('/nationals-2026/index.html');
    // A real routine from the authored SCHEDULE is visible as plain text.
    await expect(page.locator('.ns-fallback')).toContainText("Don't Rain On My Parade");
    await expect(page.locator('.ns-fallback')).toContainText('Quinn Adams');
    // Day heading present.
    await expect(page.locator('.ns-fallback h3').first()).toContainText('Sunday, June 28');
    // Chrome that only works with JS (search/filter/offset, the JS-built
    // schedule container) is hidden rather than shown broken/inert.
    await expect(page.locator('#filter-bar')).toBeHidden();
    await expect(page.locator('#offset-bar')).toBeHidden();
    await expect(page.locator('#schedule-container')).toBeHidden();
  });

  test('regionals-spring-2027 shows the sample schedule and its sample banner', async ({ page }) => {
    await page.goto('/regionals-spring-2027/index.html');
    // Static markup (not JS-dependent) — the sample disclosure still shows.
    await expect(page.locator('.sample-banner')).toBeVisible();
    await expect(page.locator('.ns-fallback')).not.toHaveCount(0);
    await expect(page.locator('#filter-bar')).toBeHidden();
  });

  test('no banned live-timing phrasing in the no-JS fallback content', async ({ page }) => {
    await page.goto('/nationals-2026/index.html');
    const text = (await page.locator('.ns-fallback').innerText()).toLowerCase();
    for (const banned of ['up next', 'next up', 'routines remaining', 'running ahead',
      'running behind', 'now performing', 'performing now', 'live timing']) {
      expect(text).not.toContain(banned);
    }
  });
});
