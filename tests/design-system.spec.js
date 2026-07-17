const { test, expect } = require('@playwright/test');

// P1.1 — design tokens are available everywhere and reduced-motion is honored.
const PAGES = [
  { name: 'homepage', path: '/index.html' },
  { name: 'nationals-2026', path: '/nationals-2026/index.html' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html' },
];

for (const { name, path } of PAGES) {
  test.describe(`${name} design system`, () => {
    test('shared design tokens are defined on :root', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const tokens = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return {
          bg: cs.getPropertyValue('--color-bg').trim(),
          purple: cs.getPropertyValue('--purple').trim(),
          accent: cs.getPropertyValue('--accent').trim(),
          space4: cs.getPropertyValue('--space-4').trim(),
          radiusMd: cs.getPropertyValue('--radius-md').trim(),
          shadowMd: cs.getPropertyValue('--shadow-md').trim(),
          tapMin: cs.getPropertyValue('--tap-min').trim(),
        };
      });
      expect(tokens.bg).toBe('#06041a');
      expect(tokens.purple).toBe('#7c3aed');
      expect(tokens.accent).toBe('#fde68a');
      expect(tokens.space4).toBe('16px');
      expect(tokens.radiusMd).toBe('12px');
      expect(tokens.shadowMd).not.toBe('');
      expect(tokens.tapMin).toBe('44px');
    });

    // Wave 4 §3.1/§5 — one shared background layer across all three pages
    // instead of three slightly different bespoke gradients, so the app
    // shell doesn't visually "reset" moving between pages.
    test('shares one fixed .app-bg layer, positioned behind all content', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const bg = page.locator('body > .app-bg');
      await expect(bg).toHaveCount(1);
      const style = await bg.evaluate(el => {
        const cs = getComputedStyle(el);
        return { position: cs.position, zIndex: cs.zIndex, pointerEvents: cs.pointerEvents };
      });
      expect(style.position).toBe('fixed');
      expect(Number(style.zIndex)).toBeLessThan(0);
      expect(style.pointerEvents).toBe('none');
    });

    test('honors prefers-reduced-motion without hiding animate-in content', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(150);

      // Any element that animates its entrance must still end up visible.
      const animated = await page.evaluate(() => {
        const els = [...document.querySelectorAll('*')];
        const withAnim = els.filter(el => {
          const cs = getComputedStyle(el);
          return cs.animationName && cs.animationName !== 'none';
        });
        // durations should be collapsed to ~0 by the reduced-motion rule
        const maxDurationMs = Math.max(0, ...withAnim.map(el => {
          const d = getComputedStyle(el).animationDuration; // e.g. "0.00001s"
          return parseFloat(d) * 1000;
        }));
        // no animate-in element left invisible
        const hiddenByAnim = withAnim.filter(el => parseFloat(getComputedStyle(el).opacity) === 0).length;
        return { count: withAnim.length, maxDurationMs, hiddenByAnim };
      });
      expect(animated.maxDurationMs).toBeLessThan(5);
      expect(animated.hiddenByAnim).toBe(0);
    });
  });
}
