const { test, expect } = require('@playwright/test');
const { assertNoEmoji } = require('./utils');

test.describe('homepage', () => {
  test('upcoming season is shown first, no dead UI, no console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    const seasonLabels = await page.locator('.season-year').allTextContents();
    expect(seasonLabels.length).toBeGreaterThan(0);
    expect(seasonLabels[0]).not.toMatch(/Past/);
    expect(seasonLabels[seasonLabels.length - 1]).toMatch(/Past/);

    // The completed badge should render an icon, not raw emoji text.
    await expect(page.locator('#completed-check svg')).toHaveCount(1);

    // The standalone-PWA close button was removed because window.close()
    // doesn't work there — make sure it doesn't come back.
    await expect(page.locator('.pwa-close')).toHaveCount(0);

    await assertNoEmoji(page);
    expect(errors).toEqual([]);
  });

  test('location opens a maps search without navigating the parent card link', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    const mapLink = page.locator('.map-link').first();
    const address = await mapLink.getAttribute('data-address');

    // Stub window.open to capture the intended URL without actually
    // navigating anywhere — avoids depending on real network access to
    // maps.google.com from the test environment.
    await page.evaluate(() => { window.__openedUrl = null; window.open = (url) => { window.__openedUrl = url; return null; }; });
    await mapLink.click();
    const openedUrl = await page.evaluate(() => window.__openedUrl);

    expect(openedUrl).toContain('maps');
    expect(decodeURIComponent(openedUrl)).toContain(address);
    expect(page.url()).toContain('/index.html'); // clicking the map link didn't follow the card's own link
  });
});

// One UA per real-world browser family the install flow branches on.
// See assets/pwa.js installInstructions() for the source of truth.
const INSTALL_CASES = [
  {
    name: 'iOS Safari',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    visible: true,
    snippet: 'share icon',
  },
  {
    name: 'iOS Chrome',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.169 Mobile/15E148 Safari/604.1',
    visible: true,
    snippet: 'safari',
  },
  {
    name: 'iOS Firefox',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/118.0 Mobile/15E148 Safari/605.1.15',
    visible: true,
    snippet: 'safari',
  },
  {
    name: 'Android Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    visible: true,
    snippet: 'install app',
  },
  {
    name: 'Android Firefox',
    ua: 'Mozilla/5.0 (Android 13; Mobile; rv:119.0) Gecko/119.0 Firefox/119.0',
    visible: true,
    snippet: 'install',
  },
  {
    name: 'Samsung Internet',
    ua: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
    visible: true,
    snippet: 'home screen',
  },
  {
    name: 'Desktop Chrome',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    visible: true,
    snippet: 'install icon',
  },
  {
    name: 'Desktop Safari',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    visible: true,
    snippet: 'add to dock',
  },
  {
    name: 'Desktop Firefox',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
    visible: false,
  },
];

for (const { name, ua, visible, snippet } of INSTALL_CASES) {
  test(`install instructions — ${name}`, async ({ browser }) => {
    const context = await browser.newContext({ userAgent: ua });
    const page = await context.newPage();
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    // The install affordance is now a compact header chip that opens a
    // dismissible bottom sheet holding the browser-tailored instructions.
    const chipVisible = await page.locator('#install-chip').isVisible();
    expect(chipVisible, `install chip visibility for ${name}`).toBe(visible);

    if (visible) {
      await page.click('#install-chip');
      await expect(page.locator('#install-sheet')).toBeVisible();
      await expect(page.locator('#ios-instructions')).toContainText(new RegExp(snippet, 'i'));
      // The sheet is dismissible.
      await page.click('#install-sheet-close');
      await expect(page.locator('#install-sheet')).toBeHidden();
    }
    await context.close();
  });
}
