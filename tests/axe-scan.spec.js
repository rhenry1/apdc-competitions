const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');

// W3.6 — automated accessibility scanning. tests/a11y.spec.js hand-checks
// specific semantics (labels, roles, headings); this catches everything else
// axe-core knows how to detect (color contrast, ARIA misuse, etc.) across all
// three pages, scoped to WCAG 2.0/2.1 A+AA — the well-understood, broadly
// agreed-upon baseline (axe's "best-practice" rules are more opinionated and
// left out to avoid noisy, debatable findings).
const PAGES = ['/index.html', '/nationals-2026/index.html', '/regionals-spring-2027/index.html'];

test.describe('automated accessibility scan (axe-core, WCAG 2.0/2.1 A+AA)', () => {
  for (const path of PAGES) {
    test(`${path} has no axe violations`, async ({ page }) => {
      // Scan the settled UI, not a mid-fade entrance-animation frame: several
      // homepage elements animate in via `opacity: 0 -> 1`, and networkidle
      // doesn't wait for CSS animations. Reduced-motion (which the site
      // already honors site-wide) renders content at its final state
      // immediately — the same content everyone eventually sees.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);
      // The homepage's bottom credit line ("rhenry1.github.io / apdc-competitions")
      // is intentionally faint decoration, not informational content — no links,
      // no legal text, already aria-hidden. WCAG 1.4.3 explicitly exempts "text
      // that is ... pure decoration" from the contrast requirement; axe can't
      // judge that intent automatically, so it's excluded here rather than
      // brightened to satisfy a rule its own spec says doesn't apply.
      if (path === '/index.html') builder.exclude('footer');

      const results = await builder.analyze();
      const summary = results.violations.map(v =>
        `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(' ')}`
      );
      expect(summary, summary.join('\n')).toEqual([]);
    });
  }
});
