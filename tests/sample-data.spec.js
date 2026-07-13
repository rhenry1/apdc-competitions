const { test, expect } = require('@playwright/test');

// The Regionals competition is demo/sample data (it proves the countdown +
// schedule experience) but must never be presented as a real published event.
// It carries a clear "Sample data" label wherever it appears.

test('homepage hero for a sample competition shows a "Sample data" badge', async ({ page }) => {
  // Pin a date where the sample Regionals is the upcoming hero.
  await page.addInitScript(() => { window.__APDC_NOW = '2026-09-01T12:00:00'; });
  await page.goto('/index.html');
  await page.waitForLoadState('networkidle');

  const hero = page.locator('.next-hero.is-sample');
  await expect(hero).toHaveCount(1);
  await expect(hero.locator('.hero-sample-badge')).toHaveText(/sample data/i);
  // The countdown still renders — the point is to demo the feature, just labeled.
  await expect(hero.locator('.hero-days')).toBeVisible();
});

test('the sample competition page carries an unmissable "not official" banner', async ({ page }) => {
  await page.goto('/regionals-spring-2027/index.html');
  await page.waitForLoadState('networkidle');

  const banner = page.locator('.sample-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(/sample data/i);
  await expect(banner).toContainText(/not the official/i);
  // The banner is static markup, so it's present even before scripts run.
});

test('the real (Nationals) competition has no sample labeling', async ({ page }) => {
  await page.goto('/nationals-2026/index.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.sample-banner')).toHaveCount(0);
});
