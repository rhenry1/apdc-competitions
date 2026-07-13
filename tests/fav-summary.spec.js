const { test, expect } = require('@playwright/test');

// P4.2 — Favorites "day at a glance" recap. In the Favorites view, a compact
// per-day summary (count, scheduled span, longest scheduled gap) helps a parent
// plan the day. Values come only from the published schedule; the copy must not
// imply live timing.
const PATH = '/nationals-2026/index.html';

async function starCard(page, card) {
  await card.locator('.card-fav').click();
}

test.describe('favorites day-at-a-glance summary', () => {
  test('is hidden until Favorites view has favorites, then summarizes them', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');

    // Not present before anything is favorited / while in the default view.
    await expect(page.locator('#fav-summary')).toHaveCount(0);

    const cards = page.locator('.routine-card');
    await starCard(page, cards.nth(0));
    await starCard(page, cards.nth(1));

    // Still not shown outside the Favorites view.
    await expect(page.locator('#fav-summary')).toHaveCount(0);

    await page.click('.show-btn[data-filter="favorites"]');

    const box = page.locator('#fav-summary');
    await expect(box).toBeVisible();
    await expect(box.locator('.fav-summary-head')).toHaveText(/at a glance/i);
    // At least one day row, and it reports a favorite count + a scheduled span.
    await expect(box.locator('.fav-summary-day')).not.toHaveCount(0);
    await expect(box).toContainText(/favorite/i);
    await expect(box).toContainText(/scheduled/i);
  });

  test('groups favorites by day (one row per day with favorites)', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');

    const sections = page.locator('.day-section');
    const dayCount = await sections.count();
    test.skip(dayCount < 2, 'needs at least two scheduled days');

    // Favorite the first card in each of the first two day sections.
    await sections.nth(0).locator('.routine-card .card-fav').first().click();
    await sections.nth(1).locator('.routine-card .card-fav').first().click();

    await page.click('.show-btn[data-filter="favorites"]');
    await expect(page.locator('#fav-summary .fav-summary-day')).toHaveCount(2);
  });

  test('disappears when leaving the Favorites view', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');
    await starCard(page, page.locator('.routine-card').nth(0));
    await page.click('.show-btn[data-filter="favorites"]');
    await expect(page.locator('#fav-summary')).toBeVisible();

    await page.click('.show-btn[data-filter="all"]');
    await expect(page.locator('#fav-summary')).toHaveCount(0);
  });

  test('summary copy carries no live-timing phrasing', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');
    await starCard(page, page.locator('.routine-card').nth(0));
    await page.click('.show-btn[data-filter="favorites"]');

    const text = (await page.locator('#fav-summary').innerText()).toLowerCase();
    for (const banned of ['up next', 'next up', 'remaining', 'running ahead',
      'running behind', 'now performing', 'performing now', 'live']) {
      expect(text).not.toContain(banned);
    }
  });
});
