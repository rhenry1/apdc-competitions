const { test, expect } = require('@playwright/test');

// R3 — the schedule shows a loading skeleton until the data is rendered, and
// the "no routines" empty state is never shown before the data has loaded.
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html' },
];

test.describe('loading skeleton (before scripts render the schedule)', () => {
  test.use({ javaScriptEnabled: false });
  for (const { name, path } of PAGES) {
    test(`${name}: skeleton is shown, with no cards and no premature empty state`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('#schedule-skeleton')).toBeVisible();
      await expect(page.locator('.routine-card')).toHaveCount(0);
      await expect(page.locator('#no-results')).toBeHidden();
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
