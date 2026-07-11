const { test, expect } = require('@playwright/test');

// P1.0 — asserts the canonical runtime data model that favorites, unified
// search, and shareable state (later phases) build on. These read the live
// normalized model via window.APDC rather than the authored SCHEDULE literals.
const PAGES = [
  { name: 'nationals-2026', path: '/nationals-2026/index.html', expectId: 'nationals-2026' },
  { name: 'regionals-spring-2027', path: '/regionals-spring-2027/index.html', expectId: 'regionals-spring-2027' },
];

for (const { name, path, expectId } of PAGES) {
  test.describe(`${name} data model`, () => {
    test('COMPETITION_CONFIG carries canonical metadata', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const cfg = await page.evaluate(() => window.APDC.config());
      expect(cfg.id).toBe(expectId);
      expect(cfg.type).toBeTruthy();
      expect(cfg.season).toMatch(/^\d{4}-\d{4}$/);
      expect(cfg.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(cfg.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof cfg.location).toBe('object');
      expect(cfg.location.city).toBeTruthy();
      expect(cfg.location.state).toBeTruthy();
      expect(Array.isArray(cfg.resources)).toBe(true);
      expect(cfg.livestream).toBeTruthy();
    });

    test('every routine has a stable, unique id and a dancers array', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const model = await page.evaluate(() => {
        const rs = window.APDC.routines();
        return {
          count: rs.length,
          uniqueIds: new Set(rs.map(r => r.id)).size,
          allHaveId: rs.every(r => typeof r.id === 'string' && r.id.length > 0),
          allDancersArrays: rs.every(r => Array.isArray(r.dancers)),
          idsNamespaced: rs.every(r => r.id.startsWith(window.APDC.config().id + '-')),
          sample: rs[0],
        };
      });
      expect(model.count).toBeGreaterThan(0);
      expect(model.uniqueIds).toBe(model.count); // no id collisions, even for routines repeated across days
      expect(model.allHaveId).toBe(true);
      expect(model.allDancersArrays).toBe(true);
      expect(model.idsNamespaced).toBe(true);
      // canonical field names present
      for (const field of ['routineNumber', 'routineName', 'scheduledDate', 'scheduledTime', 'type', 'style', 'division', 'studio']) {
        expect(model.sample).toHaveProperty(field);
      }
    });

    test('ids are namespaced per competition (safe for cross-competition favorites)', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const prefix = await page.evaluate(() => {
        const rs = window.APDC.routines();
        return rs[0].id.split('-r')[0].split('-i')[0];
      });
      // prefix contains the competition id, so identical routine numbers in a
      // different competition can never produce a matching favorite id.
      expect(prefix).toContain(expectId);
    });

    test('every rendered card exposes its routine id in the DOM', async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const { cards, withId } = await page.evaluate(() => ({
        cards: document.querySelectorAll('.routine-card').length,
        withId: document.querySelectorAll('.routine-card[data-routine-id]').length,
      }));
      expect(withId).toBe(cards);
    });
  });
}
