const { test, expect } = require('@playwright/test');

// P1.6 — favorite routines (localStorage), Favorites-only view, persistence,
// empty state, and cross-competition safety via namespaced ids.
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html' },
];

const visible = (page) => page.locator('.routine-card:not(.hidden)');

for (const { name, path } of PAGES) {
  test.describe(`${name} favorites`, () => {
    test('starring a routine marks it, updates the count, and persists across reload', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const firstCard = visible(page).first();
      await firstCard.locator('.card-fav').click();
      await expect(firstCard).toHaveClass(/favorited/);
      await expect(firstCard.locator('.card-fav')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#fav-count')).toHaveText('1');
      expect(await page.evaluate(() => window.APDC.favorites().length)).toBe(1);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.routine-card.favorited')).toHaveCount(1);
      await expect(page.locator('#fav-count')).toHaveText('1');
    });

    test('Favorites-only view shows only starred routines; unstarring removes them', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const cards = visible(page);
      await cards.nth(0).locator('.card-fav').click();
      await cards.nth(1).locator('.card-fav').click();

      await page.click('.show-btn[data-filter="favorites"]');
      await expect(page.locator('.show-btn[data-filter="favorites"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(visible(page)).toHaveCount(2);
      await expect(page.locator('.filter-chip[data-chip="show"]')).toHaveCount(1);

      await visible(page).first().locator('.card-fav').click();
      await expect(visible(page)).toHaveCount(1);
    });

    test('Favorites-only with no favorites shows a guiding empty state', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.click('.show-btn[data-filter="favorites"]');
      await expect(visible(page)).toHaveCount(0);
      await expect(page.locator('#no-results')).toBeVisible();
      await expect(page.locator('#no-results')).toContainText(/favorite/i);
    });
  });
}

test('favorites are namespaced per competition (no cross-event false matches)', async ({ page }) => {
  // favorite a routine on nationals
  await page.goto('/nationals-2026/index.html');
  await page.waitForLoadState('networkidle');
  await visible(page).first().locator('.card-fav').click();
  const natFavId = (await page.evaluate(() => window.APDC.favorites()))[0];
  expect(natFavId).toContain('nationals-2026');

  // that id must not mark any card on the regionals page (shared localStorage, distinct ids)
  await page.goto('/regionals-spring-2027/index.html');
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => window.APDC.favorites())).toContain(natFavId); // storage is shared
  await expect(page.locator('.routine-card.favorited')).toHaveCount(0);            // but nothing matches here
  await expect(page.locator('#fav-count')).toBeHidden();
});
