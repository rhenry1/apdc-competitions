const { test, expect } = require('@playwright/test');

const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html' },
];

const visible = (page) => page.locator('.routine-card:not(.hidden)');

for (const { name, path } of PAGES) {
  test.describe(`${name} empty states`, () => {
    test('no-match search shows a polished empty state whose action restores results', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const total = await visible(page).count();

      await page.fill('#dancer-input', 'zzzznotarealname');
      await page.waitForTimeout(220);

      const empty = page.locator('#no-results');
      await expect(empty).toBeVisible();
      await expect(empty.locator('.empty-icon svg')).toHaveCount(1);
      await expect(empty.locator('.empty-title')).toHaveText(/no routines match/i);
      await expect(empty.locator('.empty-btn.primary')).toHaveText(/clear all filters/i);

      await empty.locator('.empty-btn.primary').click();
      await expect(visible(page)).toHaveCount(total);
      await expect(empty).toBeHidden();
    });

    test('favorites-only empty state offers "Browse all routines"', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.click('.show-btn[data-filter="favorites"]');

      const empty = page.locator('#no-results');
      await expect(empty.locator('.empty-title')).toHaveText(/no favorites yet/i);
      const browse = empty.locator('.empty-btn');
      await expect(browse).toHaveText(/browse all routines/i);
      await browse.click();
      await expect(empty).toBeHidden();
      await expect(page.locator('.show-btn[data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
    });

    test('a no-match with a day filter also offers "Show all days"', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const firstDayKey = await page.evaluate(() => COMPETITION_CONFIG.dayButtons[0].key);
      await page.locator('#filter-toggle').click();
      await page.click(`.day-btn[data-day="${firstDayKey}"]`);
      await page.keyboard.press('Escape');
      await page.fill('#dancer-input', 'zzzznotarealname');
      await page.waitForTimeout(220);

      const labels = await page.locator('#no-results .empty-btn').allTextContents();
      expect(labels.join(' ').toLowerCase()).toContain('clear all filters');
      expect(labels.join(' ').toLowerCase()).toContain('show all days');
    });
  });
}
