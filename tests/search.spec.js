const { test, expect } = require('@playwright/test');

// P1.4 — unified free-text search across all routine fields.
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html' },
];

const visible = (page) => page.locator('.routine-card:not(.hidden)');

for (const { name, path } of PAGES) {
  test.describe(`${name} unified search`, () => {
    test('search by routine name filters cards; clear restores them', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const total = await visible(page).count();

      const firstName = await page.evaluate(() => window.APDC.routines()[0].routineName);
      await page.fill('#dancer-input', firstName);
      await page.waitForTimeout(220);
      const n = await visible(page).count();
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(total);

      // clear button restores everything
      await expect(page.locator('#search-clear')).toBeVisible();
      await page.click('#search-clear');
      await page.waitForTimeout(150);
      await expect(visible(page)).toHaveCount(total);
    });

    test('search matches a routine number', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const num = await page.evaluate(() => window.APDC.routines()[0].routineNumber);
      await page.fill('#dancer-input', num);
      await page.waitForTimeout(220);
      const texts = await visible(page).evaluateAll(cards => cards.map(c => c.dataset.search));
      expect(texts.length).toBeGreaterThan(0);
      expect(texts.every(t => t.includes(num.toLowerCase()))).toBe(true);
    });

    test('search composes with the day filter', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' }); // day filters live in the drawer
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // pick a routine and search its name scoped to a different day → no results
      const r = await page.evaluate(() => {
        const rs = window.APDC.routines();
        const first = rs[0];
        const otherDay = window.APDC.config().dayButtons.map(b => b.key).find(k => k !== first.day);
        return { name: first.routineName, day: first.day, otherDay };
      });
      await page.fill('#dancer-input', r.name);
      await page.waitForTimeout(220);
      const both = await visible(page).count();
      expect(both).toBeGreaterThan(0);

      if (r.otherDay) {
        await page.locator('#filter-toggle').click();
        await page.click(`.day-btn[data-day="${r.otherDay}"]`);
        await page.waitForTimeout(150);
        // that routine isn't on the other day → no matches, no-results shown
        await expect(visible(page)).toHaveCount(0);
        await expect(page.locator('#no-results')).toBeVisible();
      }
    });

    test('dancer suggestions still pin a dancer and clear the search', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const dancer = await page.evaluate(() => window.APDC.dancers()[0]);

      await page.fill('#dancer-input', dancer);
      await page.waitForTimeout(220);
      await expect(page.locator('.dropdown-item').first()).toBeVisible();
      await page.locator('.dropdown-item').first().click();
      await page.waitForTimeout(150);

      await expect(page.locator('#active-filters .filter-chip[data-chip^="dancer:"]')).toHaveCount(1);
      await expect(page.locator('#dancer-input')).toHaveValue('');
      await expect(page.locator('#quinn-callout')).toBeVisible();
    });
  });
}

// Nationals has hyphenated "Hip-Hop"; a spaced query must still match it.
test('punctuation-tolerant: "hip hop" matches Hip-Hop routines', async ({ page }) => {
  await page.goto('/nationals-2026/index.html');
  await page.waitForLoadState('networkidle');
  await page.fill('#dancer-input', 'hip hop');
  await page.waitForTimeout(220);
  const n = await visible(page).count();
  expect(n).toBeGreaterThan(0);
});

// A non-dancer query filters cards but shows no dancer-suggestion dropdown.
test('non-dancer query filters without opening the suggestion dropdown', async ({ page }) => {
  await page.goto('/nationals-2026/index.html');
  await page.waitForLoadState('networkidle');
  await page.fill('#dancer-input', 'jazz');
  await page.waitForTimeout(220);
  expect(await visible(page).count()).toBeGreaterThan(0);
  await expect(page.locator('#dancer-dropdown')).not.toHaveClass(/open/);
});
