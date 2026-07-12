const { test, expect } = require('@playwright/test');

// R4 — schedule-page chrome refinements: header hierarchy (type eyebrow → name
// → where/when), the livestream resource card, and the one-time offset
// first-use estimate reminder.
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html' },
];

for (const { name, path } of PAGES) {
  test(`${name}: header shows a type eyebrow, the name as h1, and where/when below`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#header-eyebrow')).toHaveText(/nationals|regionals/i);
    await expect(page.locator('h1#header-title')).not.toHaveText(/^Competition Schedule$/); // populated from data
    // where/when sits on its own line below the title, and keeps the maps link
    await expect(page.locator('#header-subtitle a')).toHaveAttribute('href', /maps/);
  });

  test(`${name}: first offset adjustment shows a one-time estimate reminder`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.click('.offset-btn[data-delta="15"]');
    await expect(page.locator('#action-toast')).toContainText(/personal estimate/i);
    // The always-on disclaimer note remains regardless (P1.7 guarantee).
    await expect(page.locator('.offset-note')).toBeVisible();
  });
}

test('nationals: livestream is one resource card with the stream link and copyable password', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/nationals-2026/index.html');
  await page.waitForLoadState('networkidle');
  const card = page.locator('.livestream-card');
  await expect(card).toBeVisible();
  await expect(card.locator('#livestream-btn')).toHaveAttribute('href', /live-stream/);
  await expect(card.locator('#stream-pw')).toHaveText('APDC2026');

  await card.locator('#pw-copy-btn').click();
  await expect(card.locator('#pw-copy-btn')).toContainText(/copied/i);
  expect((await page.evaluate(() => navigator.clipboard.readText())).trim()).toBe('APDC2026');
});

test('regionals: no livestream card is shown when the competition has no stream', async ({ page }) => {
  await page.goto('/regionals-spring-2027/index.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.livestream-card')).toHaveCount(0);
});
