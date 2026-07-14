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
  test('a competition page never visited online still renders offline', async ({ page, context, browserName }) => {
    // Known, deterministic Playwright/WebKit-on-Linux limitation, not a real
    // app gap: page.goto()/reload() reliably throws "WebKit encountered an
    // internal error" while context.setOffline(true) is active in this CI
    // environment (github.com/microsoft/playwright#27337, #34450) — it
    // reproduces on every retry, so it isn't transient flakiness. Real
    // Safari/WebKit does support service workers and true offline use; this
    // is purely an automation-layer limitation of Playwright's WebKit driver.
    test.skip(browserName === 'webkit', 'Playwright/WebKit-on-Linux cannot navigate while context.setOffline(true) is active — see comment above.');
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

  test('the hub renders offline, and a deep link with query params resolves', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright/WebKit-on-Linux cannot navigate while context.setOffline(true) is active — see comment on the first test in this file.');
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

  test('offline indicator is present on an offline page load (hub)', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright/WebKit-on-Linux cannot navigate while context.setOffline(true) is active — see comment on the first test in this file.');
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await swReady(page);

    await context.setOffline(true);
    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#offline-indicator')).toBeVisible();
    await context.setOffline(false);
  });

  // W3.4 — brand fonts are self-hosted + precached, so they survive offline
  // instead of silently falling back to a system font.
  test('brand fonts (self-hosted) stay loaded offline', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright/WebKit-on-Linux cannot navigate while context.setOffline(true) is active — see comment on the first test in this file.');
    await page.goto('/nationals-2026/index.html');
    await page.waitForLoadState('networkidle');
    await swReady(page);

    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const h1Family = await page.locator('h1').evaluate(el => getComputedStyle(el).fontFamily);
    expect(h1Family).toContain('Tenor Sans');
    const loadedFamilies = await page.evaluate(() =>
      [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family)
    );
    expect(loadedFamilies).toEqual(expect.arrayContaining(['Tenor Sans', 'DM Mono', 'Inter']));
    await context.setOffline(false);
  });
});
