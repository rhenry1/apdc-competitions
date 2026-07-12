const { test, expect } = require('@playwright/test');

// P2.6 — a quiet "Schedule updated <date>" line reflects when the published
// data was last edited. It is not live/day-of timing (guarded by P1.10).
const PAGES = [
  '/nationals-2026/index.html',
  '/regionals-spring-2027/index.html',
];

for (const path of PAGES) {
  test(`${path} shows a formatted last-updated date`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const el = page.locator('#last-updated');
    await expect(el).toBeVisible();
    await expect(el).toContainText(/schedule updated/i);
    await expect(el).toContainText(/Jul 12, 2026/);
  });
}
