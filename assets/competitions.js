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

  // Parse a YYYY-MM-DD string as a local-midnight Date (avoids the UTC shift
  // `new Date('2026-10-11')` would introduce).
  function parseDay(s) {
    var p = String(s).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // Whole days from `now` until a competition's start. 0 on the start day,
  // negative once it has begun. Uses calendar days, not elapsed hours.
  function daysUntil(comp, now) {
    var MS = 86400000;
    return Math.round((startOfDay(parseDay(comp.startDate)) - startOfDay(now || new Date())) / MS);
  }

  // 'before' | 'during' | 'past' relative to the inclusive date range.
  function phase(comp, now) {
    var today = startOfDay(now || new Date());
    var start = startOfDay(parseDay(comp.startDate));
    var end = startOfDay(parseDay(comp.endDate));
    if (today < start) return 'before';
    if (today > end) return 'past';
    return 'during';
  }

  // The soonest competition that hasn't finished yet (currently running counts).
  function next(now) {
    var live = COMPETITIONS
      .filter(function (c) { return phase(c, now) !== 'past'; })
      .sort(function (a, b) { return parseDay(a.startDate) - parseDay(b.startDate); });
    return live.length ? live[0] : null;
  }

  function upcoming(now) {
    return COMPETITIONS
      .filter(function (c) { return phase(c, now) !== 'past'; })
      .sort(function (a, b) { return parseDay(a.startDate) - parseDay(b.startDate); });
  }

  function past(now) {
    return COMPETITIONS
      .filter(function (c) { return phase(c, now) === 'past'; })
      .sort(function (a, b) { return parseDay(b.startDate) - parseDay(a.startDate); });
  }

  global.APDCComps = {
    all: function () { return COMPETITIONS.slice(); },
    next: next,
    upcoming: upcoming,
    past: past,
    phase: phase,
    daysUntil: daysUntil,
    parseDay: parseDay,
  };
})(typeof window !== 'undefined' ? window : this);
