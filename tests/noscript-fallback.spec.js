const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { buildForFile } = require('../scripts/build-noscript.js');

// W3.1 — the core schedule must render even if JS fails entirely (the site's
// own working agreement). Every competition page ships a <noscript> fallback
// generated straight from that page's SCHEDULE data, so it can never drift
// from what the interactive engine renders.
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html', file: 'nationals-2026/index.html' },
  { name: 'regionals-march-2027', path: '/regionals-march-2027/index.html', file: 'regionals-march-2027/index.html' },
  { name: 'regionals-april-2027', path: '/regionals-april-2027/index.html', file: 'regionals-april-2027/index.html' },
  { name: 'regionals-may-2027', path: '/regionals-may-2027/index.html', file: 'regionals-may-2027/index.html' },
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

  test('regionals-march-2027 shows the "not yet published" placeholder, no sample banner', async ({ page }) => {
    await page.goto('/regionals-march-2027/index.html');
    await expect(page.locator('.sample-banner')).toHaveCount(0);
    await expect(page.locator('.ns-fallback')).toContainText(/not yet published/i);
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
