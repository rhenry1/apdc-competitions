/**
 * Shared competition manifest — the single source of truth the landing page
 * (and future overview pages) read to render cards, seasons, and the
 * date-based countdown. Keep each entry's public fields in sync with that
 * competition page's own COMPETITION_CONFIG (name / type / season / status /
 * startDate / endDate / dates / location).
 *
 * `status` is descriptive only; the live phase (before / during / past) is
 * derived from today's date against startDate/endDate so a card never goes
 * stale on its own. Dates are inclusive calendar days (YYYY-MM-DD), compared
 * in local time — no time-of-day, so we never imply live/official timing.
 */
(function (global) {
  'use strict';

  // Newest first is not required; helpers sort as needed.
  var COMPETITIONS = [
    {
      id: 'regionals-spring-2027',
      name: 'Turn It Up Regionals — Fall 2026',
      type: 'Regionals',
      season: '2026-2027',
      seasonLabel: '2026 – 2027 Season',
      status: 'upcoming',
      startDate: '2026-10-11',
      endDate: '2026-10-12',
      dates: 'October 11–12, 2026',
      city: 'Cherry Hill',
      state: 'NJ',
      url: 'regionals-spring-2027/',
      accent: 'regional',
      published: true,
      // Demo/sample competition: proves the countdown + schedule experience,
      // but is NOT a real published event. Surfaced with a clear "Sample data"
      // label wherever it appears so it's never mistaken for the real schedule.
      sample: true,
    },
    {
      id: 'nationals-2026',
      name: 'Turn It Up Nationals 2026',
      type: 'Nationals',
      season: '2025-2026',
      seasonLabel: '2025 – 2026 Season',
      status: 'past',
      startDate: '2026-06-28',
      endDate: '2026-07-03',
      dates: 'June 28 – July 3',
      city: 'Long Branch',
      state: 'NJ',
      url: 'nationals-2026/',
      accent: 'nationals',
      published: true,
    },
  ];

  // Test/preview hook: inject extra competitions (e.g. an announced-but-undated
  // future event) to exercise the season-hero path without shipping speculative
  // data in the real manifest. Mirrors the window.__APDC_NOW date hook.
  if (global.__APDC_EXTRA_COMPS && global.__APDC_EXTRA_COMPS.length) {
    COMPETITIONS = COMPETITIONS.concat(global.__APDC_EXTRA_COMPS);
  }

  // Parse a YYYY-MM-DD string as a local-midnight Date (avoids the UTC shift
  // `new Date('2026-10-11')` would introduce).
  function parseDay(s) {
    var p = String(s).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // A competition has exact dates only when it declares a startDate. Entries
  // without one are "announced but undated" — the schedule/dates are still TBA.
  function hasDates(comp) { return !!(comp && comp.startDate); }

  // Whole days from `now` until a competition's start. 0 on the start day,
  // negative once it has begun. Uses calendar days, not elapsed hours.
  function daysUntil(comp, now) {
    var MS = 86400000;
    return Math.round((startOfDay(parseDay(comp.startDate)) - startOfDay(now || new Date())) / MS);
  }

  // Sort key: dated competitions order by their start; undated ones sort to the
  // end (they're announced for "later this season", after anything with a date).
  function sortKey(comp) {
    return hasDates(comp) ? parseDay(comp.startDate).getTime() : Number.MAX_SAFE_INTEGER;
  }

  // 'before' | 'during' | 'past' for dated events; 'announced' for undated ones
  // (which are never "past" on their own — they simply await a date).
  function phase(comp, now) {
    if (!hasDates(comp)) return 'announced';
    var today = startOfDay(now || new Date());
    var start = startOfDay(parseDay(comp.startDate));
    var end = startOfDay(parseDay(comp.endDate || comp.startDate));
    if (today < start) return 'before';
    if (today > end) return 'past';
    return 'during';
  }

  // The soonest competition that hasn't finished yet — a dated one if any is
  // still upcoming/running, otherwise the first announced-but-undated one.
  function next(now) {
    var live = upcoming(now);
    return live.length ? live[0] : null;
  }

  function upcoming(now) {
    return COMPETITIONS
      .filter(function (c) { return phase(c, now) !== 'past'; })
      .sort(function (a, b) { return sortKey(a) - sortKey(b); });
  }

  function past(now) {
    return COMPETITIONS
      .filter(function (c) { return phase(c, now) === 'past'; })
      .sort(function (a, b) { return sortKey(b) - sortKey(a); });
  }

  global.APDCComps = {
    all: function () { return COMPETITIONS.slice(); },
    next: next,
    upcoming: upcoming,
    past: past,
    phase: phase,
    hasDates: hasDates,
    daysUntil: daysUntil,
    parseDay: parseDay,
  };
})(typeof window !== 'undefined' ? window : this);
