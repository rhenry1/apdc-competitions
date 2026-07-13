const { test, expect } = require('@playwright/test');

// P4.1 — print-friendly schedule. A Print button triggers the browser print
// dialog; the @media print stylesheet strips the app chrome and lays the
// visible routines out cleanly on white. Filtering to Favorites first prints a
// personal schedule. Printed times are the published scheduled times.
const PATH = '/nationals-2026/index.html';

test.describe('print schedule', () => {
  test('print styles strip the app chrome but keep the routines + disclaimer', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');
    await page.emulateMedia({ media: 'print' });

    await expect(page.locator('.filter-bar')).toBeHidden();
    await expect(page.locator('.offset-bar')).toBeHidden();
    await expect(page.locator('.schedule-tools')).toBeHidden();
    await expect(page.locator('.livestream-bar')).toBeHidden();

    await expect(page.locator('.routine-card').first()).toBeVisible();
    await expect(page.locator('.card-fav').first()).toBeHidden();       // no interactive star on paper
    await expect(page.locator('.card-actions').first()).toBeHidden();   // no share/calendar buttons
    await expect(page.locator('.print-footer')).toBeVisible();
    await expect(page.locator('.print-footer')).toContainText(/subject to change/i);
  });

  test('the Print button opens the browser print dialog', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await page.click('#print-btn');
    expect(await page.evaluate(() => window.__printed)).toBe(1);
  });

  test('printing in Favorites view yields a personal schedule (only starred routines)', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');
    const favs = page.locator('.routine-card .card-fav');
    await favs.nth(0).click();
    await favs.nth(1).click();
    await page.click('.show-btn[data-filter="favorites"]');

    await page.emulateMedia({ media: 'print' });
    // Only the two starred cards remain; filtered-out cards are visually gone
    // under print media (not just class-hidden) — the regression that let the
    // whole schedule print in Favorites view.
    await expect(page.locator('.routine-card:not(.hidden)')).toHaveCount(2);
    await expect(page.locator('.routine-card:not(.hidden)').nth(0)).toBeVisible();
    await expect(page.locator('.routine-card.hidden').first()).toBeHidden();
  });

  test('an active offset estimate is not printed (published times only)', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');
    await page.click('.offset-btn[data-delta="15"]'); // shift the on-screen estimate
    await page.emulateMedia({ media: 'print' });
    // The adjusted-estimate span is hidden in print; the original time remains.
    await expect(page.locator('.card-time--shifted .time-adjusted').first()).toBeHidden();
    await expect(page.locator('.card-time--shifted .time-original').first()).toBeVisible();
  });
});
