const { test, expect } = require('@playwright/test');

// P1.2 — the Comfortable/Compact density toggle and its persistence.
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html' },
];

for (const { name, path } of PAGES) {
  test.describe(`${name} density toggle`, () => {
    test('defaults to comfortable with tags and actions visible', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).not.toHaveClass(/compact/);
      await expect(page.locator('.density-toggle button[data-density="comfortable"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.routine-card:not(.hidden) .card-meta').first()).toBeVisible();
      await expect(page.locator('.routine-card:not(.hidden) .card-actions').first()).toBeVisible();
    });

    test('Compact hides tags + per-card actions and updates aria-pressed', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      await page.click('.density-toggle button[data-density="compact"]');
      await expect(page.locator('body')).toHaveClass(/compact/);
      await expect(page.locator('.density-toggle button[data-density="compact"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.density-toggle button[data-density="comfortable"]')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('.routine-card:not(.hidden) .card-meta').first()).toBeHidden();
      await expect(page.locator('.routine-card:not(.hidden) .card-actions').first()).toBeHidden();

      // routine name + entry number stay visible in compact mode
      await expect(page.locator('.routine-card:not(.hidden) .card-title').first()).toBeVisible();
      await expect(page.locator('.routine-card:not(.hidden) .entry-num').first()).toBeVisible();
    });

    test('density preference persists across reload', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.click('.density-toggle button[data-density="compact"]');
      await expect(page.locator('body')).toHaveClass(/compact/);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).toHaveClass(/compact/);
      await expect(page.locator('.density-toggle button[data-density="compact"]')).toHaveAttribute('aria-pressed', 'true');
    });

    test('card action buttons meet a comfortable tap size', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const box = await page.locator('.routine-card:not(.hidden) .card-action-btn').first().boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(32);
      expect(box.height).toBeGreaterThanOrEqual(32);
    });
  });
}
