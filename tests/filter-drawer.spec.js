const { test, expect } = require('@playwright/test');

// P1.5 — accessible filter drawer (bottom sheet) + unified active-filter chips.
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html' },
];

for (const { name, path } of PAGES) {
  test.describe(`${name} filter drawer`, () => {
    test.use({ reducedMotion: 'reduce' });

    test('opens as a modal dialog, traps focus, closes on Escape and restores focus', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // relocated to <body> so it can be a viewport bottom sheet
      await expect(page.locator('body > #filter-extra')).toHaveCount(1);
      const drawer = page.locator('#filter-extra');
      await expect(drawer).toHaveAttribute('role', 'dialog');
      await expect(drawer).toHaveAttribute('aria-modal', 'true');

      const toggle = page.locator('#filter-toggle');
      await toggle.click();
      await expect(drawer).toHaveClass(/open/);
      await expect(page.locator('.filter-backdrop')).toHaveClass(/open/);
      // focus moved into the drawer
      expect(await page.evaluate(() => document.getElementById('filter-extra').contains(document.activeElement))).toBe(true);

      await page.keyboard.press('Escape');
      await expect(drawer).not.toHaveClass(/open/);
      // focus returned to the trigger
      expect(await page.evaluate(() => document.activeElement === document.getElementById('filter-toggle'))).toBe(true);
    });

    test('backdrop click closes the drawer', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.locator('#filter-toggle').click();
      await expect(page.locator('#filter-extra')).toHaveClass(/open/);
      await page.locator('.filter-backdrop').click({ position: { x: 5, y: 5 } });
      await expect(page.locator('#filter-extra')).not.toHaveClass(/open/);
    });
  });

  test.describe(`${name} active-filter chips`, () => {
    test.use({ reducedMotion: 'reduce' });

    test('setting Type and Day shows removable chips that reset on remove', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const chips = page.locator('#active-filters .filter-chip');
      await expect(page.locator('#active-filters')).not.toHaveClass(/visible/);

      await page.locator('#filter-toggle').click();
      await page.click('.cat-btn[data-format="solo"]');
      const firstDayKey = await page.evaluate(() => COMPETITION_CONFIG.dayButtons[0].key);
      await page.click(`.day-btn[data-day="${firstDayKey}"]`);
      await page.keyboard.press('Escape');

      await expect(page.locator('#active-filters')).toHaveClass(/visible/);
      await expect(page.locator('.filter-chip[data-chip="format"]')).toHaveCount(1);
      await expect(page.locator('.filter-chip[data-chip="day"]')).toHaveCount(1);

      // removing the day chip resets the day filter
      await page.locator('.filter-chip[data-chip="day"] .chip-remove').click();
      await expect(page.locator('.filter-chip[data-chip="day"]')).toHaveCount(0);
      await expect(page.locator('.day-btn[data-day="all"]')).toHaveAttribute('aria-pressed', 'true');

      // removing the type chip resets category → chips row empties
      await page.locator('.filter-chip[data-chip="format"] .chip-remove').click();
      await expect(chips).toHaveCount(0);
      await expect(page.locator('#active-filters')).not.toHaveClass(/visible/);
    });

    test('a search shows a removable Search chip', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.fill('#dancer-input', 'jazz');
      await page.waitForTimeout(200);
      const chip = page.locator('.filter-chip[data-chip="search"]');
      await expect(chip).toHaveCount(1);
      await chip.locator('.chip-remove').click();
      await expect(chip).toHaveCount(0);
      await expect(page.locator('#dancer-input')).toHaveValue('');
    });
  });
}
