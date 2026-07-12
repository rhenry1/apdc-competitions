const { test, expect } = require('@playwright/test');
const { assertNoEmoji } = require('./utils');

// Assertions are derived from each page's own SCHEDULE/COMPETITION_CONFIG data
// rather than hardcoded counts, so these keep passing after the routine data
// is replaced for a new season.
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html' },
];

for (const { name, path } of PAGES) {
  test.describe(name, () => {
    test('renders every routine in SCHEDULE, no console errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const expectedCount = await page.evaluate(
        () => Object.values(SCHEDULE).flat().filter((i) => i.type === 'routine').length
      );
      expect(expectedCount).toBeGreaterThan(0);
      await expect(page.locator('.routine-card')).toHaveCount(expectedCount);
      expect(errors).toEqual([]);
    });

    test('Props filter shows exactly the props routines', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const expectedProps = await page.evaluate(
        () => Object.values(SCHEDULE).flat().filter((i) => i.type === 'routine' && i.props).length
      );
      await page.click('.show-btn[data-filter="props"]');
      await expect(page.locator('.routine-card:not(.hidden)')).toHaveCount(expectedProps);
      await expect(page.locator('.show-btn[data-filter="props"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.show-btn[data-filter="all"]')).toHaveAttribute('aria-pressed', 'false');
    });

    test('day filter narrows the schedule to that day only', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' }); // drawer opens instantly
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const firstDayKey = await page.evaluate(() => COMPETITION_CONFIG.dayButtons[0].key);
      await page.locator('#filter-toggle').click(); // open drawer (day filters live inside)
      await page.click(`.day-btn[data-day="${firstDayKey}"]`);

      const days = await page
        .locator('.day-section:not(.hidden)')
        .evaluateAll((sections) => sections.map((s) => s.getAttribute('data-day')));
      expect(new Set(days)).toEqual(new Set([firstDayKey]));
    });

    test('dancer search filters, and removing the pill restores the full schedule', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const firstDancer = await page.evaluate(() => {
        const set = new Set();
        Object.values(SCHEDULE)
          .flat()
          .filter((i) => i.type === 'routine')
          .forEach((r) => r.dancers.split(',').map((s) => s.trim()).forEach((n) => n && set.add(n)));
        return [...set][0];
      });

      const totalCards = await page.locator('.routine-card').count();

      await page.fill('#dancer-input', firstDancer);
      await page.locator('.dropdown-item').first().click();
      // the pinned dancer now shows as a removable chip beneath the toolbar
      const dancerChip = page.locator('#active-filters .filter-chip[data-chip^="dancer:"]');
      await expect(dancerChip).toHaveCount(1);
      await expect(page.locator('#quinn-callout')).toBeVisible();

      const filteredCount = await page.locator('.routine-card:not(.hidden)').count();
      expect(filteredCount).toBeGreaterThan(0);
      expect(filteredCount).toBeLessThanOrEqual(totalCards);

      await dancerChip.locator('.chip-remove').click();
      await expect(dancerChip).toHaveCount(0);
      await expect(page.locator('.routine-card:not(.hidden)')).toHaveCount(totalCards);
    });

    test('schedule offset shifts times and persists across reload', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      await page.click('.offset-btn[data-delta="15"]');
      await expect(page.locator('#offset-status')).toContainText('+15');
      await expect(page.locator('.card-time.card-time--shifted').first()).toBeVisible();

      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#offset-status')).toContainText('+15');
      await expect(page.locator('.offset-btn[data-delta="15"]')).toHaveAttribute('aria-pressed', 'true');
    });

    test('More Filters drawer shows an active-filter badge after a drawer filter is set', async ({ page }) => {
      // reduced-motion collapses the drawer slide so interactions don't race the transition
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const toggle = page.locator('#filter-toggle');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#filter-badge')).toBeHidden();

      await toggle.click(); // opens the drawer
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#filter-extra')).toHaveClass(/open/);

      const firstDayKey = await page.evaluate(() => COMPETITION_CONFIG.dayButtons[0].key);
      await page.click(`.day-btn[data-day="${firstDayKey}"]`);
      await page.keyboard.press('Escape'); // close the drawer

      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#filter-badge')).toBeVisible();
      await expect(page.locator('#filter-badge')).toHaveText('1');
    });

    test('entry number and age stay visible on a narrow phone viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.entry-num').first()).toBeVisible();
      await expect(page.locator('.age-badge').first()).toBeVisible();
    });

    test('no legend, no dead pwa-close button, no emoji', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.legend')).toHaveCount(0);
      await expect(page.locator('.pwa-close')).toHaveCount(0);
      await assertNoEmoji(page);
    });

    test('location links to a maps search for the venue', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // location is a structured object now; the maps query is derived via
      // window.APDC.mapsQuery() and the visible label via locationLabel().
      const { query, label } = await page.evaluate(() => ({
        query: window.APDC.mapsQuery(window.APDC.config().location),
        label: window.APDC.locationLabel(window.APDC.config().location),
      }));
      const href = await page.locator('#header-subtitle a').getAttribute('href');
      expect(href).toContain('maps');
      expect(decodeURIComponent(href)).toContain(query);
      await expect(page.locator('#header-subtitle a')).toContainText(label);
    });

    test('Share falls back to copying routine details to the clipboard', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const firstRoutine = await page.evaluate(
        () => Object.values(SCHEDULE).flat().find((i) => i.type === 'routine')
      );

      await page.locator('.routine-card .card-action-btn').first().click();
      await expect(page.locator('#action-toast')).toContainText('Copied');

      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toContain(firstRoutine.title);
    });

    test('Add to Calendar downloads a valid .ics for the routine', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const firstRoutine = await page.evaluate(
        () => Object.values(SCHEDULE).flat().find((i) => i.type === 'routine')
      );

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('.routine-card .card-action-btn').nth(1).click(),
      ]);
      const icsPath = await download.path();
      const ics = require('fs').readFileSync(icsPath, 'utf-8');

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('DTSTART:');
      expect(ics).toContain(`SUMMARY:${firstRoutine.title}`);
      // ICS text values escape commas — assert on the escaped form.
      expect(ics).toContain('LOCATION:');
      expect(ics).not.toMatch(/DESCRIPTION:.*\\\\n/); // no double-escaped newlines
    });
  });
}
