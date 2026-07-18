const { test, expect } = require('@playwright/test');
const fs = require('fs');

// P4.1 — print-friendly schedule. An Export button opens a small menu with
// Print/Save as PDF (the @media print stylesheet strips the app chrome and
// lays the visible routines out cleanly on white) and Download as Excel.
// Filtering to Favorites (or a single day) first exports just that subset.
// Both printed and exported times are the published scheduled times, never
// the personal offset estimate.
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

  test('Export → Print / Save as PDF opens the browser print dialog', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await page.click('#export-btn');
    await page.click('#export-print');
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

test.describe('export menu', () => {
  test('opens on click; closes on outside click and Escape', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');
    const panel = page.locator('#export-panel');
    await expect(panel).toBeHidden();

    await page.click('#export-btn');
    await expect(panel).toBeVisible();
    await expect(page.locator('#export-btn')).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.locator('#export-btn')).toHaveAttribute('aria-expanded', 'false');

    await page.click('#export-btn');
    await expect(panel).toBeVisible();
    await page.click('body', { position: { x: 5, y: 5 } });
    await expect(panel).toBeHidden();
  });

  test('Download as Excel exports the currently visible routines as a CSV', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');
    const visibleCount = await page.locator('.routine-card:not(.hidden)').count();

    await page.click('#export-btn');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#export-excel'),
    ]);
    expect(download.suggestedFilename()).toMatch(/schedule\.csv$/);

    const csv = fs.readFileSync(await download.path(), 'utf-8');
    const lines = csv.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Day,Time,Entry #,Routine,Age Group,Format,Style,Stage,Studio,Dancers');
    expect(lines.length - 1).toBe(visibleCount);
  });

  test('Excel export reflects the active day filter', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // drawer opens instantly
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');

    const firstDayKey = await page.evaluate(() => COMPETITION_CONFIG.dayButtons[0].key);
    await page.locator('#filter-toggle').click(); // open drawer (day filters live inside)
    await page.click(`.day-btn[data-day="${firstDayKey}"]`);
    await page.locator('.filter-drawer-close').click(); // drawer would otherwise cover the export button
    const visibleCount = await page.locator('.routine-card:not(.hidden)').count();
    expect(visibleCount).toBeGreaterThan(0);

    await page.click('#export-btn');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#export-excel'),
    ]);
    const csv = fs.readFileSync(await download.path(), 'utf-8');
    const lines = csv.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines.length - 1).toBe(visibleCount);
  });
});
