# APDC Competition Schedule Portal — V2 Roadmap

Plan of record for the V2 enhancement effort. This is multi-session work; do not
attempt it in one pass. Each phase lands as one or more small PRs into the `v2`
branch, which merges to `main` (the GitHub Pages source) at agreed milestones.

## Branch / hosting strategy

- **Same repo, long-lived `v2` branch.** Not a separate repo — that would force
  re-creating Pages config, the `/apdc-competitions/` base path, relative asset
  paths, the 404 redirect, and CI, and would fragment history.
- The live site keeps serving V1 from `main` until `v2` is merged.
- Each work item = a short-lived `v2-<phase>-<slug>` branch → PR into `v2`.
- Items marked **[ship-safe]** preserve all existing behavior and could be
  cherry-merged to `main` early if we want to release progressively.

## Hard product constraint (never violate)

**No live routine tracking.** The portal has no verified live feed. Nothing may
claim to know the current routine, whether the event runs ahead/behind, real
start times, routines-remaining, a live countdown, or a calculated backstage
time. Date-based countdowns ("12 days until Nationals", "Day 2 of 5") and the
**user-controlled** manual offset are the only time-awareness allowed, and the
offset must be labeled a personal estimate that adjusts *displayed* times only.

- **Guardrail test (add in Phase 1):** a Playwright/text test that greps rendered
  UI + source strings for banned phrases ("performing now", "up next in",
  "running late", "minutes until", "estimated stage time", etc.) and fails if any
  appear. This protects the constraint across all future changes.

## Existing behavior that must remain intact (regression baseline)

Current state: static GitHub Pages site, `/apdc-competitions/` base path, no
backend. Shared engine in `assets/`; per-competition data embedded in each
`<competition>/index.html` as `COMPETITION_CONFIG` + `SCHEDULE`; 14 Playwright
cases (33 runtime variants) currently green.

Must not break:
- Landing hub (`index.html`) with upcoming + past-season sections.
- Competition schedule pages (`nationals-2026/`, `regionals-spring-2027/`) and
  their direct URLs.
- Filters: dancer, studio, routine-type, day; clear actions; props filter.
- Manual schedule offset (persisted per `apdc-schedule-offset`).
- Livestream link + password + copy action (nationals page).
- Add-to-Home-Screen flow, `manifest.json`, `service-worker.js`, icons.
- Per-card Share + Add-to-Calendar (.ics) + venue maps link (shipped in V1).
- Static hosting; no backend; no paid services.

## Known gaps found during discovery (fold into the phases below)

1. **Offline is broken on schedule subpages** — `service-worker.js` caches only
   the hub shell + `assets/{icons,pwa}.{js,css}`; it does *not* cache
   `schedule-engine.js`, `schedule-theme.css`, or the competition pages. → Phase 3.
2. **Manifest maskable anti-pattern** — both icons are `"purpose": "any maskable"`;
   maskable needs a safe zone or it crops. Also no `id` / `screenshots`. → Phase 3.
3. **No `prefers-reduced-motion` handling** despite 4 keyframe animations. → Phase 1.
4. **No meta description / Open Graph tags** — shared links preview as bare URLs. → Phase 2 (sharing).
5. **Routine identity is array-position-based** — favorites + share-state need
   stable IDs first. → Foundation (Phase 1).
6. **`regionals-spring-2027` is placeholder data** (19 TBD routines) — needs real
   data before public launch; fine while marked "Soon".

---

## Phase 1 — Core schedule experience

Foundation first (unblocks favorites, search, share-state):

- **P1.0 Data-architecture refactor** — ✅ DONE (branch `v2-p1.0-data-architecture`).
  Added a `normalizeRoutine()` layer producing the canonical runtime model
  (`window.APDC.routines()`); authored per-page `SCHEDULE` format preserved as-is
  and normalized at load. Expanded `COMPETITION_CONFIG` (`id`, `type`, `season`,
  `status`, `startDate`/`endDate`, structured `location{venue,city,state,address}`,
  `livestream{url,password}`, `resources[]`, `lastUpdated`); added `locationLabel()`
  / `mapsQuery()` helpers (string-or-object tolerant). Rendered output unchanged.
  **Key decision:** routine `id` is **day-scoped** —
  `<competition-id>-<dayKey>-r<routineNumber>` — because 7 nationals routine
  numbers legitimately appear on two days (regular day + Battle Day). This keeps
  ids unique per scheduled instance while `routineNumber` still links repeats.
  Favorites (P1.6) will decide whether to key on `id` (per-instance) or
  `routineNumber` (logical routine). `window.APDC` exposes read-only accessors.
- **P1.1 Design tokens + reduced-motion** — ✅ DONE (branch `v2-p1.1-design-tokens`).
  Added `assets/tokens.css` (loaded first on all 3 pages): brand purple scale,
  gold accent, surfaces, text, borders, status colors, radii, 4px spacing scale,
  subtle shadows, `--tap-min: 44px`. Values match current palette → no visual
  change. Began adoption by aliasing `schedule-theme` `--bg/--card/--border/--text/
  --muted/--stage1/--gold` to the tokens. Added site-wide
  `@media (prefers-reduced-motion: reduce)` that collapses animations/transitions
  while letting animate-in elements settle visible. Tests: `design-system.spec.js`.
  **Deferred:** the small `.card-action-btn` (24px) and dense filter/offset
  buttons are below the 44px tap-target target; enforcing that changes layout, so
  it's folded into P1.2 (card redesign) / P1.3 (toolbar) rather than forced here.
  Safe-area insets are already handled via `env()` in existing CSS.
  **TODO (Phase 3):** add `tokens.css` to the service-worker precache list.
- **P1.2 Schedule card redesign** — ✅ DONE (branch `v2-p1.2-card-redesign`).
  Token-based card refresh: time as the scan anchor, routine name as hero with
  entry # as a muted kicker, pill tags, 34px action buttons, softer shadows/radii.
  Added a persisted Comfortable/Compact density toggle (Compact hides tags +
  per-card actions for dense scanning). DOM/classes unchanged so prior tests hold;
  added `card-view.spec.js`. Kept the existing category/meta rows for session
  grouping (data only has explicit sessions on Battle Day).
  **Deferred:** sticky day headers → P1.3 (their sticky offset depends on the
  consolidated toolbar height). Desktop wide-card sparseness → left as-is per
  user (mobile-first is the priority; not a concern for them).
- **P1.3 Sticky toolbar** — ✅ DONE (branch `v2-p1.3-toolbar`). The big page
  header now scrolls away; the engine wraps the filter bar + offset bar into one
  `.schedule-toolbar` (sticky top:0) and keeps `--toolbar-h` in sync via a
  ResizeObserver. Sticky day headers pin just below the toolbar. Added a global
  "Clear all filters" (in the schedule-tools row, shows when any filter active,
  resets show/type/studio/dancer/day — not the offset). Also hide any day section
  whose routines are all filtered out, so no empty sticky headers appear. Tests:
  `toolbar.spec.js`. **Favorites toggle** slot reserved for P1.6.
- **P1.4 Unified search** — debounced, case-insensitive, punctuation-tolerant;
  matches dancer/routine/studio/number/style/type/division/stage/props; one-tap
  clear; composes with all filters.
- **P1.5 Filter drawer + active-filter chips** — mobile filter sheet with focus
  management; removable chips + Clear All; only show meaningful categories.
- **P1.6 Favorites** — star action; localStorage keyed by `competitionId` +
  routine `id` (safe across identical names in different competitions);
  favorites-only view; guided empty state. Privacy: never leaves the device.
- **P1.7 Manual-offset disclaimer** — add the required helper text; label it a
  personal estimate; keep persistence + "On Time" reset. **[ship-safe]**
- **P1.8 Empty / error states** — polished states with next-actions (clear
  filters, all days, disable favorites-only).
- **P1.9 Accessibility pass** — semantic headings, focus states, aria-expanded/
  selected/dialog, screen-reader labels for icon buttons, keyboard nav.
- **P1.10 Guardrail test** — banned live-timing phrase check (see constraint).

## Phase 2 — Competition dashboard & resources

- **P2.1 Landing dashboard** — next-competition hero card with date-based
  countdown + "Competition Weekend" label when today ∈ date range; upcoming cards
  with published/disabled states; collapsible past-season section.
- **P2.2 Competition overview page** — data-driven fields (venue, address, website,
  livestream, hotel, parking, arrival, awards, notes, docs, last-updated); no
  empty placeholder rows.
- **P2.3 Resources section** — data-driven resource cards; external links labeled.
- **P2.4 Sharing + deep links** — encode non-sensitive filter/day/dancer state in
  URL query params; restore on load; native share sheet + copy-link fallback;
  add meta description + OG/Twitter tags + share image.
- **P2.5 Calendar export expansion** — whole competition range, all favorites,
  awards sessions; events carry change-disclaimer.
- **P2.6 Last-updated messaging.**
- **P2.7 Bottom navigation / IA** — Home / Schedule / Favorites / More; hide
  destinations with no content; safe-area aware.

## Phase 3 — PWA & offline polish

- **P3.1 Full offline shell** — cache engine JS/CSS + competition pages + schedule
  data + repo-hosted resources (never external livestream video). Fixes gap #1.
- **P3.2 Offline indicator** — subtle banner; keep serving cached schedule.
- **P3.3 Update-available flow** — "Schedule update available" toast; user-chosen
  refresh; no abrupt reload mid-view; stale-cache cleanup.
- **P3.4 Install-state detection + dismissal persistence** (partly done in V1).
- **P3.5 Manifest fixes** — split maskable/any icons, add `id`, screenshots. Fixes gap #2.

## Phase 4 — Optional

Dark mode (proper OS-pref + override toggle; note the brand is already dark),
packing/costume checklists, results/awards history, more season archives,
print-friendly personal schedule, personal-schedule summary (first/last favorite
routine per day, counts, gaps — all labeled "scheduled").

---

## Working agreements

- Incremental refactor over rewrite; reuse the shared engine, keep data-driven.
- Progressive enhancement: core schedule must render even if optional JS fails.
- Add/update Playwright tests with every feature; test iPhone-sized viewports
  and assert no horizontal overflow.
- Preserve working URLs and the `/apdc-competitions/` base path.
- After each phase: full test run, link check, offline check, a11y + console-error
  check, and a changed-files summary.
