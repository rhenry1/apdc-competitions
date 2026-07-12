const { test, expect } = require('@playwright/test');

// P3.1 — full offline shell. After one visit anywhere on the site, the service
// worker has precached the hub, both competition pages (schedule data is
// embedded in them), and all shared assets, so every page renders offline.
// These tests drive the real SW in Chromium: install → precache → cut the
// network → navigate.

// Wait for the SW to activate and finish precaching (addAll resolves before
// install completes, so poll for a known precache key). Cache-name agnostic so
// version bumps don't break the test.
async function swReady(page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(async () => {
    const names = (await caches.keys()).filter(n => n.startsWith('apdc-'));
    for (const name of names) {
      const cache = await caches.open(name);
      if (await cache.match('/regionals-spring-2027/index.html')) return true;
    }
    return false;
  }, null, { timeout: 15000 });
}

test.describe('offline shell', () => {
  test('a competition page never visited online still renders offline', async ({ page, context }) => {
    // Visit only the hub — the precache must cover the rest of the site.
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await swReady(page);

    await context.setOffline(true);
    await page.goto('/nationals-2026/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.routine-card', { timeout: 15000 });
    expect(await page.locator('.routine-card').count()).toBeGreaterThan(0);
    // Styled, not a bare-HTML fallback: the engine + theme came from cache.
    await expect(page.locator('#header-eyebrow')).toContainText(/nationals/i);
    await context.setOffline(false);
  });

  test('the hub renders offline, and a deep link with query params resolves', async ({ page, context }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await swReady(page);

    await context.setOffline(true);

    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.next-hero')).toBeVisible();

    // Deep links carry query params the precache keys don't have — the SW
    // ignores the search string for navigations, so shared links open offline.
    // The ?day=mon filter also restores, so only Monday cards are visible.
    await page.goto('/nationals-2026/index.html?day=mon');
    await page.waitForSelector('.routine-card:not(.hidden)', { timeout: 15000 });
    expect(await page.locator('.routine-card:not(.hidden)').count()).toBeGreaterThan(0);
    await expect(page.locator('.filter-chip[data-chip="day"]')).toBeVisible();
    await context.setOffline(false);
  });

  // P3.2 — a subtle pill tells the user they're offline (the cached schedule
  // keeps being served either way); it disappears when connectivity returns.
  test('offline indicator appears while offline and hides when back online', async ({ page, context }) => {
    await page.goto('/nationals-2026/index.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#offline-indicator')).toBeHidden();

    await context.setOffline(true);
    await expect(page.locator('#offline-indicator')).toBeVisible();
    await expect(page.locator('#offline-indicator')).toContainText(/offline/i);
    await expect(page.locator('#offline-indicator')).toHaveAttribute('role', 'status');

    await context.setOffline(false);
    await expect(page.locator('#offline-indicator')).toBeHidden();
  });

  test('offline indicator is present on an offline page load (hub)', async ({ page, context }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await swReady(page);

    await context.setOffline(true);
    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#offline-indicator')).toBeVisible();
    await context.setOffline(false);
  });
});
