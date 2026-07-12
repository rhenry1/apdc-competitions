const { test, expect } = require('@playwright/test');
const fs = require('fs');

// P2.5 — calendar export expansion. In the Favorites view, all favorited
// routines can be exported as a single multi-event .ics. Each event keeps the
// "times may change" disclaimer; nothing implies live/official timing.
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html' },
];

for (const { name, path } of PAGES) {
  test.describe(`${name} favorites calendar export`, () => {
    test('export bar appears only in Favorites view with favorites present', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // No favorites yet → no export bar, even in Favorites view.
      await page.click('.show-btn[data-filter="favorites"]');
      await expect(page.locator('#fav-export-bar')).toHaveCount(0);

      // Back to all, favorite two routines.
      await page.click('.show-btn[data-filter="all"]');
      const favs = page.locator('.routine-card .card-fav');
      await favs.nth(0).click();
      await favs.nth(1).click();

      // In Favorites view the bar shows the count.
      await page.click('.show-btn[data-filter="favorites"]');
      await expect(page.locator('#fav-export-bar')).toBeVisible();
      await expect(page.locator('.fav-export-count')).toHaveText(/2 favorites/i);
    });

    test('exports all favorites as one multi-event calendar file', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const titles = [];
      const cards = page.locator('.routine-card');
      for (let i = 0; i < 2; i++) {
        titles.push((await cards.nth(i).locator('.card-title').innerText()).trim());
        await cards.nth(i).locator('.card-fav').click();
      }
      await page.click('.show-btn[data-filter="favorites"]');

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('.fav-export-btn'),
      ]);
      expect(download.suggestedFilename()).toMatch(/favorites\.ics$/);
      const ics = fs.readFileSync(await download.path(), 'utf-8');

      expect((ics.match(/BEGIN:VCALENDAR/g) || []).length).toBe(1);
      expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(2);
      // The change disclaimer rides along on every event.
      expect(ics).toContain('competition times may change');
    });
  });
}
