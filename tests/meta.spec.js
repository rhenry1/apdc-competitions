const { test, expect } = require('@playwright/test');

// P2.4 — social/SEO metadata. Every page carries a description plus
// OpenGraph/Twitter tags and a large share image so links preview nicely.
const PAGES = [
  '/index.html',
  '/nationals-2026/index.html',
  '/regionals-spring-2027/index.html',
];

for (const path of PAGES) {
  test(`${path} has description + OpenGraph/Twitter share metadata`, async ({ page }) => {
    await page.goto(path);

    const content = (sel) => page.locator(sel).getAttribute('content');

    expect((await content('meta[name="description"]') || '').length).toBeGreaterThan(30);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /rhenry1\.github\.io\/apdc-competitions/);

    expect(await content('meta[property="og:title"]')).toBeTruthy();
    expect(await content('meta[property="og:description"]')).toBeTruthy();
    expect(await content('meta[property="og:image"]')).toMatch(/og-image\.png$/);
    expect(await content('meta[property="og:image:width"]')).toBe('1200');
    expect(await content('meta[property="og:image:height"]')).toBe('630');
    expect(await content('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(await content('meta[name="twitter:image"]')).toMatch(/og-image\.png$/);
  });
}
