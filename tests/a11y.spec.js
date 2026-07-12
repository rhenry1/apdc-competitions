const { test, expect } = require('@playwright/test');

// P1.9 — accessibility pass. (Drawer focus-trap/dialog semantics are covered
// in filter-drawer.spec.js; aria-pressed states in the filter specs.)
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html' },
];

for (const { name, path } of PAGES) {
  test.describe(`${name} accessibility`, () => {
    test('has a single h1 and day titles are h2 headings', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1')).toHaveCount(1);
      const h2 = await page.locator('h2.day-title').count();
      expect(h2).toBeGreaterThan(0);
    });

    test('search and studio inputs have accessible labels', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#dancer-input')).toHaveAttribute('aria-label', /search/i);
      await expect(page.locator('#studio-input')).toHaveAttribute('aria-label', /studio/i);
    });

    test('control groups expose role=group with a label', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#cat-row')).toHaveAttribute('role', 'group');
      await expect(page.locator('#cat-row')).toHaveAttribute('aria-label', /type/i);
      await expect(page.locator('#day-filter-row')).toHaveAttribute('aria-label', /day/i);
      await expect(page.locator('.offset-btns')).toHaveAttribute('role', 'group');
    });

    test('a skip link is the first focusable and targets the schedule', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => ({
        cls: document.activeElement.className,
        href: document.activeElement.getAttribute('href'),
      }));
      expect(focused.cls).toContain('skip-link');
      expect(focused.href).toBe('#main-content');
    });

    test('result count is announced via an aria-live region', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const sr = page.locator('#sr-status');
      await expect(sr).toHaveAttribute('aria-live', 'polite');
      await page.fill('#dancer-input', 'zzzznotarealname');
      await page.waitForTimeout(250);
      await expect(sr).toContainText(/no routines match/i);
    });
  });
}
