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
  for (const f of ['/icon-maskable-192.png', '/icon-maskable-512.png',
                   '/screenshot-home.png', '/screenshot-schedule.png']) {
    const res = await request.get(f);
    expect(res.ok(), `${f} should exist`).toBe(true);
    expect(res.headers()['content-type']).toContain('image/png');
  }
});

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
