const { test, expect } = require('@playwright/test');

// P2.4 — shareable deep links. Non-sensitive view state (day, pinned
// dancers/studios, search text, the Props category) is mirrored into the URL
// and restored on load. Favorites stay private/local — never in the URL. A
// ?routine=<id> link opens cleanly and spotlights that card.
const PATH = '/nationals-2026/index.html';

test.describe('deep links', () => {
  // Collapse the drawer slide animation so day buttons are clickable the moment
  // the drawer opens (avoids a mid-animation off-viewport flake under load).
  test.use({ reducedMotion: 'reduce' });

  test('search text is written to the URL and restored on reload', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');

    await page.fill('#dancer-input', 'jazz');
    await expect(page).toHaveURL(/q=jazz/);

    await page.goto(page.url());
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#dancer-input')).toHaveValue('jazz');
    await expect(page.locator('.filter-chip[data-chip="search"]')).toBeVisible();
  });

  test('the selected day is written to the URL and restored on reload', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');

    // Day buttons live inside the collapsible filter drawer. Fire the handler
    // directly instead of a pointer click — avoids a drawer-animation/off-
    // viewport flake under parallel load; we're testing the state→URL wiring.
    const dayBtn = page.locator('.day-btn:not([data-day="all"])').first();
    const day = await dayBtn.getAttribute('data-day');
    await dayBtn.evaluate((el) => el.click());
    await expect(page).toHaveURL(new RegExp('day=' + day));

    await page.goto(page.url());
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.day-btn[data-day="' + day + '"]')).toHaveClass(/active/);
  });

  test('the Props category is encoded but Favorites (private) is not', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');

    await page.click('.show-btn[data-filter="props"]');
    await expect(page).toHaveURL(/cat=props/);

    await page.click('.show-btn[data-filter="favorites"]');
    await expect(page).toHaveURL(/nationals-2026\/index\.html$/);
  });

  test('a ?routine=<id> link scrolls to and highlights that card', async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');
    const id = await page.locator('.routine-card').first().getAttribute('data-routine-id');

    await page.goto(PATH + '?routine=' + encodeURIComponent(id));
    await page.waitForLoadState('networkidle');
    const card = page.locator('.routine-card[data-routine-id="' + id + '"]');
    await expect(card).toHaveClass(/deep-target/);
    await expect(card).toBeInViewport();
    // A routine link carries no filters — the full schedule is still present.
    await expect(page.locator('.filter-chip')).toHaveCount(0);
  });

  test('the share button copies a deep link to the routine (clipboard fallback)', async ({ page }) => {
    await page.addInitScript(() => {
      try { Object.defineProperty(navigator, 'share', { get: () => undefined, configurable: true }); } catch (e) {}
      window.__copied = null;
      navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); };
    });
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');

    const card = page.locator('.routine-card').first();
    const id = await card.getAttribute('data-routine-id');
    await card.locator('.card-action-btn').first().click();

    const copied = await page.evaluate(() => window.__copied);
    expect(copied).toContain('routine=' + id);
  });
});
