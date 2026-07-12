const { test, expect } = require('@playwright/test');

// P3.3 — update-available flow. An updated service worker installs but WAITS;
// a toast offers "Schedule update available — Refresh", and the page reloads
// only when the user opts in. The first install never reloads the page.
//
// To simulate "a new version shipped" we register the same worker script under
// a new URL (?v=…): same scope ⇒ the browser treats it as an update and parks
// it in the waiting state, exactly like a byte-changed deploy.

async function controlled(page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
}

test.describe('service-worker update flow', () => {
  test('first install never reloads the page mid-view', async ({ page }) => {
    await page.goto('/nationals-2026/index.html');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { window.__notReloaded = true; });
    await controlled(page); // clients.claim() fires controllerchange here
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.__notReloaded)).toBe(true);
    await expect(page.locator('#update-toast')).toHaveCount(0);
  });

  test('a waiting update shows the toast; Refresh applies it and reloads once', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await controlled(page);

    // Ship an "update": same scope, new script URL → installed + waiting.
    await page.evaluate(() => { window.__beforeRefresh = true; });
    await page.evaluate(() => { navigator.serviceWorker.register('/service-worker.js?v=test-update'); });

    const toast = page.locator('#update-toast');
    await expect(toast).toBeVisible({ timeout: 15000 });
    await expect(toast).toContainText(/schedule update available/i);

    // The toast alone must not reload anything.
    expect(await page.evaluate(() => window.__beforeRefresh)).toBe(true);

    // User opts in → SKIP_WAITING → controllerchange → one reload.
    await toast.locator('.update-refresh').click();
    await page.waitForFunction(() => !window.__beforeRefresh, null, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // After the reload the user-chosen worker controls the page. (No assertion
    // on toast absence here: re-registering the canonical URL over the ?v=…
    // controller reads as yet another update — an artifact of this simulation
    // that can't occur in production, where the script URL never changes.)
    expect(await page.evaluate(() =>
      (navigator.serviceWorker.controller || {}).scriptURL || ''
    )).toContain('v=test-update');
  });
});
