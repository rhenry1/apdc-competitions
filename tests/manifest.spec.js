const { test, expect } = require('@playwright/test');

// P3.5 — manifest fixes: a stable id, icon purposes split into separate
// any/maskable entries (an "any maskable" combo icon crops on launchers), and
// store-style screenshots.
// P3.4 — install-state coherence: the dismissible banner respects dismissal,
// while the header chip stays available as a quiet, persistent affordance.

test('manifest has an id, split any/maskable icons, and screenshots', async ({ request }) => {
  const res = await request.get('/manifest.json');
  expect(res.ok()).toBe(true);
  const m = await res.json();

  expect(m.id).toBe('/apdc-competitions/');
  expect(m.start_url).toBe('/apdc-competitions/');

  const purposes = m.icons.map(i => i.purpose);
  expect(purposes).not.toContain('any maskable'); // the anti-pattern
  const any = m.icons.filter(i => i.purpose === 'any').map(i => i.sizes);
  const maskable = m.icons.filter(i => i.purpose === 'maskable').map(i => i.sizes);
  expect(any).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(maskable).toEqual(expect.arrayContaining(['192x192', '512x512']));

  expect(m.screenshots.length).toBeGreaterThanOrEqual(2);
  for (const s of m.screenshots) {
    expect(s.form_factor).toBe('narrow');
    expect(s.label).toBeTruthy();
  }
});

test('manifest icon + screenshot files actually exist', async ({ request }) => {
  // Manifest srcs are production-absolute (/apdc-competitions/…); check the
  // repo-root-relative equivalents the test server exposes.
  for (const f of ['/icons/icon-maskable-192.png', '/icons/icon-maskable-512.png',
                   '/icons/screenshot-home.png', '/icons/screenshot-schedule.png']) {
    const res = await request.get(f);
    expect(res.ok(), `${f} should exist`).toBe(true);
    expect(res.headers()['content-type']).toContain('image/png');
  }
});

// Wave 4 §3.11 — no white flash on launch, and a consistent home-screen
// label regardless of which page the user happened to "Add to Home
// Screen" from. Only the homepage had the inline <html> background before
// this; the two schedule pages (the more likely install/deep-link target)
// relied entirely on an external stylesheet loading first.
const PAGES = ['/index.html', '/nationals-2026/index.html', '/regionals-spring-2027/index.html'];
for (const path of PAGES) {
  test(`${path}: <html> paints the app background before any CSS loads`, async ({ page }) => {
    await page.goto(path);
    // On the schedule pages, page JS re-serializes the whole style attribute
    // when it later sets --toolbar-h via .style.setProperty(), which
    // normalizes #06041a to its rgb() form — check the resolved color
    // rather than the literal hex text.
    const bg = await page.evaluate(() => document.documentElement.style.background);
    expect(bg).toMatch(/#06041a|rgb\(6,\s*4,\s*26\)/);
  });

  test(`${path}: consistent home-screen title metadata`, async ({ page }) => {
    await page.goto(path);
    const content = (name) => page.locator(`meta[name="${name}"]`).getAttribute('content');
    expect(await content('apple-mobile-web-app-title')).toBe('APDC');
    expect(await content('application-name')).toBe('APDC');
  });
}

test('dismissed install banner stays dismissed while the header chip remains', async ({ browser }) => {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('apdc-install-dismissed', '1'));
  await page.goto('/index.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3200); // the banner would auto-show at ~2.5s

  await expect(page.locator('#install-banner')).toBeHidden();
  // The chip is a quiet affordance, not a nag — it deliberately survives
  // banner dismissal so installing stays one tap away.
  await expect(page.locator('#install-chip')).toBeVisible();
  await context.close();
});
