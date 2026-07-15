const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// P1.10 — product guardrail (non-negotiable). The portal must NEVER claim to
// know real-time event state: which routine is performing, whether the event is
// running ahead/behind, actual/live start times, routines remaining, a live
// countdown to a routine, or a backstage arrival time. The manual offset is
// allowed *only* as a clearly-labeled personal estimate (guarded separately in
// offset-disclaimer.spec.js), and date-based countdowns (days until an event)
// are allowed. This test fails the build if any banned live-timing claim ships.
//
// Patterns are written as affirmative claims so the legitimate disclaimer copy
// ("does not reflect official or live timing") does not trip them.
const BANNED = [
  { re: /\bnow performing\b/i, why: 'implies live "which routine is on" tracking' },
  { re: /\bcurrently performing\b/i, why: 'implies live performance tracking' },
  { re: /\bperforming now\b/i, why: 'implies live performance tracking' },
  { re: /\bon ?stage now\b/i, why: 'implies live performance tracking' },
  { re: /\bup next\b/i, why: 'implies live position in the running order' },
  { re: /\bnext up\b/i, why: 'implies live position in the running order' },
  { re: /\brunning (ahead|behind)\b/i, why: 'claims live ahead/behind status' },
  { re: /\b(ahead|behind) of schedule\b/i, why: 'claims live ahead/behind status' },
  { re: /\bon schedule\b/i, why: 'claims live on-time status' },
  { re: /\broutines? (remaining|left)\b/i, why: 'claims live count of routines left' },
  { re: /\blive countdown\b/i, why: 'claims a live per-routine countdown' },
  { re: /\bcountdown to (?:the )?(?:next )?(?:routine|performance|dance)\b/i, why: 'live per-routine countdown' },
  { re: /\bactual start time/i, why: 'claims a real/actual start time' },
  { re: /\bofficial start time/i, why: 'claims an official start time' },
  { re: /\blive (?:start|timing|schedule|update)/i, why: 'claims live timing data' },
  { re: /\barrive backstage\b/i, why: 'claims a backstage arrival time' },
  { re: /\breport (?:to )?backstage\b/i, why: 'claims a backstage arrival time' },
  { re: /\bbackstage (?:in|by|at)\b/i, why: 'claims a backstage arrival time' },
  { re: /\bbackstage arrival\b/i, why: 'claims a backstage arrival time' },
];

const PAGES = [
  '/index.html',
  '/nationals-2026/index.html',
  '/regionals-spring-2027/index.html',
];

// The approved offset disclaimer intentionally says the estimate "does not
// reflect official or live timing". Strip that exact negated clause so the
// guardrail only flags *affirmative* live-timing claims, never the disclaimer.
function stripDisclaimer(text) {
  return text.replace(/does not reflect official or live timing/gi, '[disclaimer]');
}

function scan(rawText, source) {
  const text = stripDisclaimer(rawText);
  for (const { re, why } of BANNED) {
    const m = text.match(re);
    if (m) {
      const i = Math.max(0, m.index - 40);
      const snippet = text.slice(i, m.index + m[0].length + 40).replace(/\s+/g, ' ').trim();
      return `${source}: banned live-timing phrase "${m[0]}" (${why}) — …${snippet}…`;
    }
  }
  return null;
}

test.describe('no-live-timing guardrail', () => {
  for (const p of PAGES) {
    test(`${p} renders no banned live-timing claims`, async ({ page }) => {
      await page.goto(p);
      await page.waitForLoadState('networkidle');
      // Reveal any collapsed/drawer content so hidden templated copy is scanned.
      const bodyText = await page.evaluate(() => document.body.innerText);
      const finding = scan(bodyText, `rendered ${p}`);
      expect(finding, finding || 'clean').toBeNull();
    });
  }

  test('shared engine + page sources contain no banned live-timing claims', () => {
    const root = path.resolve(__dirname, '..');
    const files = [
      'assets/schedule-data.js',
      'assets/schedule-cards.js',
      'assets/schedule-calendar.js',
      'assets/schedule-build.js',
      'assets/schedule-filters.js',
      'assets/schedule-search.js',
      'assets/schedule-toolbar.js',
      'assets/schedule-api.js',
      'assets/schedule-init.js',
      'nationals-2026/index.html',
      'regionals-spring-2027/index.html',
      'index.html',
    ];
    const findings = [];
    for (const rel of files) {
      const full = path.join(root, rel);
      if (!fs.existsSync(full)) continue;
      const finding = scan(fs.readFileSync(full, 'utf8'), rel);
      if (finding) findings.push(finding);
    }
    expect(findings, findings.join('\n') || 'clean').toEqual([]);
  });
});
