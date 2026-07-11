const { test, expect } = require('@playwright/test');

// P1.3 — sticky toolbar consolidation, sticky day headers, global clear-all,
// and hiding day sections that have no matching routines.
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html' },
];

for (const { name, path } of PAGES) {
  test.describe(`${name} toolbar`, () => {
    test('filter + offset controls are wrapped in one sticky toolbar with a measured height', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('.schedule-toolbar #filter-bar')).toHaveCount(1);
      await expect(page.locator('.schedule-toolbar #offset-bar')).toHaveCount(1);
      await expect(page.locator('.schedule-toolbar')).toHaveCSS('position', 'sticky');

      const toolbarH = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--toolbar-h')));
      expect(toolbarH).toBeGreaterThan(0);

      // the big page header no longer pins to the top
      await expect(page.locator('header')).not.toHaveCSS('position', 'sticky');
    });

    test('day headers are sticky and pinned below the toolbar', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const dayHeader = page.locator('.day-header').first();
      await expect(dayHeader).toHaveCSS('position', 'sticky');
      const top = await dayHeader.evaluate(el => getComputedStyle(el).top);
      expect(parseFloat(top)).toBeGreaterThan(0); // offset by --toolbar-h
    });

    test('global clear-all appears when a filter is active and resets everything', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const clearAll = page.locator('#clear-all-global');
      await expect(clearAll).toBeHidden();

      await page.click('.show-btn[data-filter="props"]');
      await expect(clearAll).toBeVisible();

      await clearAll.click();
      await expect(clearAll).toBeHidden();
      await expect(page.locator('.show-btn[data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.show-btn[data-filter="props"]')).toHaveAttribute('aria-pressed', 'false');
    });

    test('no visible day section is ever empty (no empty sticky headers)', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.click('.show-btn[data-filter="props"]');
      await page.waitForTimeout(150);

      const emptyVisible = await page.evaluate(() =>
        [...document.querySelectorAll('.day-section')]
          .filter(s => !s.classList.contains('hidden'))
          .filter(s => !s.querySelector('.routine-card:not(.hidden)')).length);
      expect(emptyVisible).toBe(0);
    });
  });
}

// Deterministic check that a whole day section hides when a filter matches
// none of its routines. Nationals has days with zero props routines.
test('day sections with no matching routines are removed under a filter', async ({ page }) => {
  await page.goto('/nationals-2026/index.html');
  await page.waitForLoadState('networkidle');
  const total = await page.locator('.day-section').count();
  await page.click('.show-btn[data-filter="props"]');
  await page.waitForTimeout(150);
  const visible = await page.locator('.day-section:not(.hidden)').count();
  expect(visible).toBeGreaterThan(0);
  expect(visible).toBeLessThan(total);
});
