const { test, expect } = require('@playwright/test');

// P1.7 — the manual schedule offset must be clearly labeled a personal estimate
// that only adjusts displayed times, never presented as official/live timing.
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html' },
];

for (const { name, path } of PAGES) {
  test.describe(`${name} offset disclaimer`, () => {
    test('offset control is labeled an estimate with the required disclaimer', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('.offset-label')).toHaveText(/adjust times/i);

      const note = page.locator('.offset-note');
      await expect(note).toBeVisible();
      await expect(note).toContainText(/personal estimate/i);
      await expect(note).toContainText(/displayed times/i);
      await expect(note).toContainText(/does not reflect official or live timing/i);
    });

    test('active-offset status is marked as an estimate and On Time resets it', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      await page.click('.offset-btn[data-delta="15"]');
      await expect(page.locator('#offset-status')).toContainText(/estimate/i);
      await expect(page.locator('#offset-status')).toContainText('+15');

      // obvious "On Time" reset
      await page.click('.offset-btn[data-delta="0"]');
      await expect(page.locator('#offset-status')).toBeHidden();
      await expect(page.locator('.offset-btn[data-delta="0"]')).toHaveAttribute('aria-pressed', 'true');
    });
  });
}
