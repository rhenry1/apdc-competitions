const { test, expect } = require('@playwright/test');

// P2.1 — data-driven landing dashboard: next-competition hero with a
// date-based countdown, "Competition Weekend" label while in range, and a
// collapsible past-season section. "today" is pinned via window.__APDC_NOW so
// the date math is deterministic. Date-based countdowns are allowed by the
// no-live-timing constraint; per-routine/live timing is not (guarded elsewhere).
async function gotoAt(page, iso) {
  await page.addInitScript((d) => { window.__APDC_NOW = d; }, iso);
  await page.goto('/index.html');
  await page.waitForLoadState('networkidle');
}

test.describe('landing dashboard', () => {
  test('before the event: hero shows the next competition with a day countdown', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await gotoAt(page, '2026-09-01T12:00:00');

    const hero = page.locator('.next-hero');
    await expect(hero).toHaveCount(1);
    await expect(hero).toHaveAttribute('href', 'regionals-spring-2027/');
    await expect(hero.locator('.hero-eyebrow')).toContainText(/next competition/i);
    await expect(hero.locator('.hero-name')).toContainText(/Regionals — Fall 2026/);
    // 2026-09-01 → 2026-10-11 is 40 calendar days.
    await expect(hero.locator('.hero-days')).toHaveText('40');
    await expect(hero.locator('.hero-days-label')).toHaveText(/days to go/i);
    await expect(hero.locator('.hero-weekend')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('during the event: hero shows the Competition Weekend label, no countdown', async ({ page }) => {
    await gotoAt(page, '2026-10-11T12:00:00');
    const hero = page.locator('.next-hero');
    await expect(hero).toHaveCount(1);
    await expect(hero.locator('.hero-weekend')).toContainText(/competition weekend/i);
    await expect(hero.locator('.hero-countdown')).toHaveCount(0);
  });

  test('past season is collapsed by default and expands on toggle', async ({ page }) => {
    await gotoAt(page, '2026-09-01T12:00:00');

    const pastRows = page.locator('#past-rows');
    await expect(pastRows).toBeHidden();
    await expect(page.locator('.past-toggle')).toHaveAttribute('aria-expanded', 'false');

    await page.click('.past-toggle');
    await expect(pastRows).toBeVisible();
    await expect(page.locator('.past-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(pastRows.locator('.comp-name')).toContainText(/Nationals 2026/);
    await expect(pastRows.locator('.completed-badge')).toContainText(/completed/i);
  });

  test('the featured competition is not duplicated as a plain row', async ({ page }) => {
    await gotoAt(page, '2026-09-01T12:00:00');
    // The upcoming comp appears once (as the hero), not also as a .comp-row.
    await expect(page.locator('.comp-row:not(.completed) .comp-name')).toHaveCount(0);
  });

  test('past rows carry no bogus "00" sequence number', async ({ page }) => {
    await gotoAt(page, '2026-09-01T12:00:00');
    await page.click('.past-toggle');
    const idx = (await page.locator('.past-rows .comp-index').first().innerText()).trim();
    expect(idx).toBe('');
  });
});

// R2 — the hero adapts to the data: an announced-but-undated competition shows
// an elegant season hero ("coming soon"); it flips to the day-countdown card
// automatically once a startDate exists. Uses window.__APDC_EXTRA_COMPS to
// inject an undated event without shipping speculative data in the manifest.
test.describe('season hero (undated competition)', () => {
  const UNDATED = [{
    id: 'nationals-2027', name: 'Turn It Up Nationals 2027', type: 'Nationals',
    season: '2026-2027', seasonLabel: '2026 – 2027 Season', status: 'announced',
    city: '', state: '', url: '', accent: 'nationals', published: false,
  }];
  async function gotoWithUndated(page, iso) {
    await page.addInitScript((d) => { window.__APDC_NOW = d.now; window.__APDC_EXTRA_COMPS = d.extra; },
      { now: iso, extra: UNDATED });
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
  }

  test('shows a season hero with "coming soon" and no countdown when the next comp is undated', async ({ page }) => {
    // After the dated Regionals has passed, the undated Nationals 2027 is next.
    await gotoWithUndated(page, '2026-11-01T12:00:00');
    const hero = page.locator('.next-hero.season-hero');
    await expect(hero).toHaveCount(1);
    await expect(hero.locator('.hero-name')).toContainText(/Nationals 2027/);
    await expect(hero.locator('.hero-soon')).toContainText(/coming soon/i);
    await expect(hero.locator('.hero-days')).toHaveCount(0); // no fake countdown
  });

  test('a dated competition still wins the hero; the undated one is a "Schedule coming soon" row', async ({ page }) => {
    await gotoWithUndated(page, '2026-09-01T12:00:00');
    // Dated Regionals keeps the countdown hero (auto-switch by data).
    await expect(page.locator('.next-hero:not(.season-hero) .hero-days')).toHaveText('40');
    // The undated one appears as a soon row.
    const soonRow = page.locator('.comp-row.soon');
    await expect(soonRow).toHaveCount(1);
    await expect(soonRow.locator('.soon-text')).toHaveText(/schedule coming soon/i);
  });
});
