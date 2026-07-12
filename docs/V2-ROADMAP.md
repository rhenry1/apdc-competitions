# APDC Competition Schedule Portal — V2 Roadmap

Plan of record for the V2 enhancement effort. This is multi-session work; do not
attempt it in one pass. Each phase lands as one or more small PRs into the `v2`
branch, which merges to `main` (the GitHub Pages source) at agreed milestones.

## Status (2026-07-12)

- **Phases 1 & 2: SHIPPED.** Merged `v2` → `main` (PR #24); the live site now
  serves V2. P2.2 / P2.3 / P2.7 deferred pending real data (see entries).
- **V2.5 refinement pass: SHIPPED** directly to `main` (PR #25) — see the
  "V2.5 refinement" section below.
- **Next up: Phase 3** (PWA/offline). Phase 4 remains optional.
- Test suite: **144 Playwright tests in 20 files**, green; CI gates every PR.

## Branch / hosting strategy

- **Same repo, long-lived `v2` branch.** Not a separate repo — that would force
  re-creating Pages config, the `/apdc-competitions/` base path, relative asset
  paths, the 404 redirect, and CI, and would fragment history.
- ~~The live site keeps serving V1 from `main` until `v2` is merged.~~ Done:
  `main` serves V2 as of 2026-07-12. `v2` is kept in sync with `main`; future
  phases can PR into `v2` and promote at milestones as before, or PR straight to
  `main` for small, ship-safe items (the V2.5 pass did the latter).
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
`<competition>/index.html` as `COMPETITION_CONFIG` + `SCHEDULE`; the homepage
renders from the `assets/competitions.js` manifest. Playwright suite has grown
from 14 cases at V1 to 144 tests across 20 files.

Must not break:
- Landing hub (`index.html`) with upcoming + past-season sections.
- Competition schedule pages (`nationals-2026/`, `regionals-spring-2027/`) and
  their direct URLs.
- Filters: dancer, studio, routine-type, day; clear actions; props filter.
- Manual schedule offset (persisted per `apdc-schedule-offset`).
- Livestream link + password + copy action (nationals page).
- Add-to-Home-Screen flow (now the V2.5 install chip + bottom sheet),
  `manifest.json`, `service-worker.js`, icons.
- Per-card Share + Add-to-Calendar (.ics) + venue maps link (shipped in V1).
- Static hosting; no backend; no paid services.

## Known gaps found during discovery (fold into the phases below)

1. **Offline is broken on schedule subpages** — `service-worker.js` caches only
   the hub shell + `assets/{icons,pwa}.{js,css}`; it does *not* cache
   `schedule-engine.js`, `schedule-theme.css`, `tokens.css`, `competitions.js`,
   or the competition pages. → Phase 3. **STILL OPEN — the main reason to do
   Phase 3.** (V2.5's loading skeleton masks the blank flash but does not make
   subpages work offline.)
2. **Manifest maskable anti-pattern** — both icons are `"purpose": "any maskable"`;
   maskable needs a safe zone or it crops. Also no `id` / `screenshots`. → Phase 3.
   **STILL OPEN.**
3. ~~No `prefers-reduced-motion` handling~~ — ✅ fixed in P1.1.
4. ~~No meta description / Open Graph tags~~ — ✅ fixed in P2.4.
5. ~~Routine identity is array-position-based~~ — ✅ fixed in P1.0 (day-scoped ids).
6. **`regionals-spring-2027` is placeholder data** (19 TBD routines) — needs real
   data before public launch. **STILL OPEN** — this is a *data* task, not a code
   task: paste the real schedule into that page's `SCHEDULE` and update
   `COMPETITION_CONFIG`/`competitions.js` when the competition publishes it.
7. *(new, from V2.5)* **Future-season entries need real names** — the season hero
   for "announced but undated" competitions is built and tested (undated entries
   in `competitions.js` render "Full schedule coming soon" and auto-flip to the
   countdown card once `startDate` is set), but no real future competition is in
   the manifest yet. When APDC announces one, add it to `competitions.js` with no
   `startDate`.

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
- **P1.4 Unified search** — ✅ DONE (branch `v2-p1.4-unified-search`). The main box
  is now a debounced (120ms), case-insensitive, punctuation-tolerant free-text
  search over a per-card `data-search` index (routineNumber/name/dancers/studio/
  style/type/division/stage/props), token-ANDed and composed with every other
  filter. Dancer-name matches still surface as suggestions so a dancer can be
  pinned (pill + callout); pinning clears the query. One-tap clear (×) inside the
  box; `activeSearch` resets via clear-all. Studio drawer input kept for exact
  studio pills. Tests: `search.spec.js`. Note: some source routine titles contain
  a ⭐ (U+2B50) — intentional program content, left as-is.
- **P1.5 Filter drawer + active-filter chips** — ✅ DONE (branch
  `v2-p1.5-filter-drawer`). The More Filters accordion became an accessible
  bottom-sheet **drawer**: the engine relocates `#filter-extra` to `<body>`
  (so `position:fixed` isn't captured by the toolbar's `backdrop-filter`),
  adds a header + close button + backdrop, `role=dialog`/`aria-modal`, focus
  move-in + trap, Escape + backdrop close, and focus return to the trigger.
  Studio/Type/Day live inside it; the sticky toolbar stays compact. Added a
  unified **active-filter chips** row beneath the toolbar (`#active-filters`)
  with removable chips for dancers, studios, search, props, type, and day —
  replacing the old in-toolbar dancer pill-row and in-drawer studio pills, so
  each filter shows in exactly one place. Tests: `filter-drawer.spec.js`;
  updated dancer-pill/badge/day tests to the chip + drawer model.
- **P1.6 Favorites** — ✅ DONE (branch `v2-p1.6-favorites`). Per-routine star
  button on every card (visible in comfortable + compact). Favorites are a flat
  Set of routine ids in `localStorage['apdc-favorites']`; ids are
  competition-namespaced (P1.0) so identical routine numbers across events never
  collide — verified by a cross-competition test. Added a "Favorites" show-btn
  (with a live count badge) for the favorites-only view, a removable Favorites
  chip, and a guided empty state ("tap the star…"). Persists across reload/PWA
  relaunch; never leaves the device. `window.APDC.favorites()/isFavorite()`
  exposed. Tests: `favorites.spec.js`.
  Note: favoriting **dancers** (spec's optional item) is deferred — the existing
  dancer-pin + spotlight callout already covers "follow a dancer"; per-routine
  stars are the more flexible primitive.
- **P1.7 Manual-offset disclaimer** — ✅ DONE (branch `v2-p1.7-offset-disclaimer`).
  Label "Schedule offset" → "Adjust times"; persistent disclaimer note ("Personal
  estimate only — shifts the displayed times… does not reflect official or live
  timing"); active status marked "· estimate"; persistence + "On Time" reset
  unchanged. Tests: `offset-disclaimer.spec.js`. **[ship-safe]**
- **P1.8 Empty / error states** — ✅ DONE (branch `v2-p1.8-empty-states`).
  Structured empty state (icon + title + message + contextual action buttons):
  no-match → "No routines match" + "Clear all filters" (+ "Show all days" when a
  day is selected); favorites-only-empty → "No favorites yet" + "Browse all
  routines". Class-toggle visibility so the flex layout applies. Tests:
  `empty-states.spec.js`. (Offline/load-failure states belong to Phase 3.)
- **P1.9 Accessibility pass** — ✅ DONE (branch `v2-p1.9-a11y`). Day titles
  promoted from `<div>` to `<h2.day-title>` so each page is a single `<h1>` +
  section `<h2>`s. Skip link injected as the first focusable element (targets
  `#main-content`). Icon-free labelling: `aria-label` on the search + studio
  inputs; `role="group"` + `aria-label` on the type row (`#cat-row`), day row
  (`#day-filter-row`), and offset buttons. Result count announced through a
  polite `#sr-status` aria-live region on every filter apply. `.sr-only` +
  `.skip-link` styles added. Tests: `a11y.spec.js` (5 × 2 pages). (Drawer
  focus-trap/dialog semantics stay in `filter-drawer.spec.js`; aria-pressed in
  the filter specs.)
- **P1.10 Guardrail test** — ✅ DONE (branch `v2-p1.10-guardrail`). Enforces the
  non-negotiable no-live-timing constraint. `no-live-timing.spec.js` scans both
  the **rendered** pages (root + both competition pages) and the **source**
  (`schedule-engine.js` + page HTML) for banned affirmative claims: "now/
  currently performing", "up next / next up", "running ahead/behind", "ahead/
  behind/on schedule", "routines remaining/left", "live countdown", per-routine
  "countdown to…", "actual/official start time", "live start/timing/schedule/
  update", and backstage-arrival phrasing. The approved offset disclaimer
  ("does not reflect official or live timing") is stripped before matching so it
  never trips the check, and date-based countdowns stay allowed. **Completes
  Phase 1.**

## Phase 2 — Competition dashboard & resources

- **P2.1 Landing dashboard** — ✅ DONE (branch `v2-p2.1-dashboard`). New
  `assets/competitions.js` is the single source of truth (public fields mirror
  each page's `COMPETITION_CONFIG`); phase (before/during/past) is derived from
  today's date, not a static flag. The homepage now renders from it: a
  **next-competition hero** with a date-based day countdown ("N days to go"),
  swapping to a **"Competition Weekend"** label while today ∈ the date range;
  the featured comp is not duplicated as a row; a **collapsible past-season**
  section (collapsed by default, `aria-expanded` toggle). Replaces the stale
  hardcoded rows (which had fabricated "Regional 1/2/3" placeholders and didn't
  even link the real upcoming event). `<noscript>` fallback lists both comps.
  "today" is overridable via `window.__APDC_NOW` for deterministic tests. Tests:
  `dashboard.spec.js`; `home.spec.js` updated. Countdown is date-based only —
  passes the P1.10 guardrail.
- **P2.2 Competition overview page** — ⏸ DEFERRED (pending data). The
  publicly-known fields are already surfaced on the schedule page — location
  (with maps link) + date range in the header subtitle, livestream + password in
  the livestream bar, and now last-updated (P2.6). The remaining overview fields
  (venue name, hotel, parking, arrival, awards, notes, docs) are empty in both
  configs, so a dedicated overview would be mostly empty rows — which the spec
  forbids. Revisit once real venue/logistics data exists; the manifest
  (`competitions.js`) is ready to carry it.
- **P2.3 Resources section** — ⏸ DEFERRED (pending data). `resources: []` is
  empty for both competitions and there are no real resource links to show yet.
  Building an empty-only renderer now would add untestable, invisible UI.
  Revisit when resource URLs exist.
- **P2.4 Sharing + deep links** — ✅ DONE (branch `v2-p2.4-sharing`). Non-sensitive
  view state (day, pinned dancers/studios, search text, the Props category) is
  mirrored into the URL via `history.replaceState` on every `applyFilters` and
  restored on load (`restoreFromURL` before the first render). Favorites stay
  private/local — never encoded. A `?routine=<id>` deep link opens cleanly
  (ignores filters so the card is always reachable), scrolls to it, and
  spotlights it (`.deep-target`, cleared on first user interaction). Per-card
  Share now carries that deep link (native share `url` + clipboard fallback
  "Link copied"). Added meta description + canonical + OpenGraph/Twitter tags
  and a generated branded 1200×630 `og-image.png` on all three pages. Tests:
  `deep-links.spec.js`, `meta.spec.js`. (Ordered ahead of P2.2/P2.3 because it
  ships with existing data and matches the earlier "share routine cards"
  request; overview/resources fields are still mostly empty.)
- **P2.5 Calendar export expansion** — ✅ DONE (branch `v2-p2.5-calendar`). The
  ICS builder was refactored into `buildVEvent`/`wrapICS`/`triggerICSDownload`
  so a single file can hold many events. In the Favorites view (and only when
  favorites exist) a `#fav-export-bar` offers **"Add all to calendar"**, which
  downloads every favorited routine as one multi-event `.ics` (`…-favorites.ics`).
  Each event keeps the "competition times may change" disclaimer — no live/
  official timing. Per-card export unchanged. Tests: `calendar-export.spec.js`.
  (Whole-day / awards-session export can follow if requested; favorites cover
  the common "my dancer's routines" case.)
- **P2.6 Last-updated messaging** — ✅ DONE (branch `v2-p2.6-lastupdated`). Both
  configs carry a real `lastUpdated` date; `renderLastUpdated()` shows a quiet
  "Schedule updated <Mon D, YYYY>" line in the header, only when the date is
  present. Reflects when the published data was edited — not day-of timing
  (passes the P1.10 guardrail). Tests: `last-updated.spec.js`.
- **P2.7 Bottom navigation / IA** — ⏸ DEFERRED (redundant for now). The app is
  effectively two screens (home + a competition schedule); on the schedule page
  the sticky toolbar already exposes All / Props / Favorites + search, and the
  header has a Home ("All Competitions") back-link. A persistent bottom nav would
  duplicate those and add layout/safe-area risk right before the `main` merge.
  Revisit if the IA grows to more real destinations (e.g. a populated overview or
  resources page from P2.2/P2.3).

## V2.5 refinement pass — ✅ SHIPPED (branch `v2.5-refinement`, PR #25 → `main`)

A 15-point polish pass on the deployed portal, requested after the Phase 2
merge. Landed as one CI-gated PR:

- **Install UX** — the homepage's prominent "Add to Home Screen" block became a
  compact header **"Install app" chip** opening a **dismissible, focus-trapped
  bottom sheet** (Escape/close/scrim; Chromium still gets the native prompt).
  Dead install-button CSS removed from `pwa.css`.
- **Season hero** — `competitions.js` now supports **announced-but-undated**
  competitions (`phase() === 'announced'`, sorted after dated ones). The
  homepage renders them as an elegant "Full schedule coming soon" hero (or a
  "Schedule coming soon." row when a dated comp holds the hero) and **auto-flips
  to the day-countdown card once `startDate` is filled in**. Test hook:
  `window.__APDC_EXTRA_COMPS`. Removed the bogus "00" index on past rows.
- **Loading states** — shimmer **skeleton** inside `#schedule-container` until
  the engine renders; the no-results empty state is **gated on `scheduleReady`**
  so it can never flash before data loads.
- **Schedule chrome** — header hierarchy is now type/season eyebrow →
  competition name (`h1`, from data) → where/when line → last-updated;
  livestream link + password consolidated into **one resource card**; a one-time
  **"personal estimate" toast** on first offset use (always-on P1.7 note kept).
- **Verified** — no horizontal overflow at 390/430/768/1024/1440; design tokens/
  dark system intact; suite green. Tests: `loading-states.spec.js`,
  `schedule-chrome.spec.js`; `dashboard`/`home` specs extended.

## Phase 3 — PWA & offline polish

- **P3.1 Full offline shell** — ✅ DONE (branch `v2-p3.1-offline`). Root cause
  found: the SW hardcoded `/apdc-competitions`, so `cache.addAll` 404'd on any
  other origin root and **install silently failed everywhere but production** —
  offline was also untestable. The base is now derived from
  `self.registration.scope`. Precache covers the full shell: hub + both
  competition pages (schedule data is embedded in them) + `tokens.css`,
  `schedule-theme.css`, `schedule-engine.js`, `competitions.js`, icons/pwa
  assets, manifest, favicons. Fetch handler now handles only **same-origin
  GETs** (fonts + external livestream go straight to network, non-GETs are
  uncacheable), caches only `response.ok`, and for navigations falls back with
  `ignoreSearch` so deep links (`?routine=…`, `?day=…`) open offline, then to
  the hub. Cache bumped to `apdc-v3`. Network-first stays (fresh when online).
  Tests: `offline.spec.js` — real SW install → precache → `setOffline(true)` →
  a page never visited online renders its schedule; deep link restores its
  filter offline. Fixes gap #1.
- **P3.2 Offline indicator** — ✅ DONE (branch `v2-p3.2-offline-indicator`).
  Shared `initOfflineIndicator()` in `pwa.js` (all three pages): a subtle
  bottom-center pill — "Offline — showing saved schedule" — with `role=status`,
  safe-area aware, shown on the `offline` event or an offline page load, hidden
  on `online` (fade + `visibility` flip so it's truly gone for AT/tests). The
  cached schedule keeps being served either way; the pill only explains why
  content may not be the latest. Tests added to `offline.spec.js`.
- **P3.3 Update-available flow** — ✅ DONE (branch `v2-p3.3-update-flow`). The
  SW no longer calls `skipWaiting()` on install: an updated worker parks in the
  waiting state, `pwa.js` detects it (`updatefound`/`reg.waiting`) and shows a
  **"Schedule update available — Refresh"** toast. Refresh posts
  `SKIP_WAITING`; the page reloads **only** on a user-initiated
  `controllerchange` (first-install `clients.claim()` never reloads). Old
  caches were already cleaned on activate. First installs still activate
  immediately (no predecessor to wait behind). Content freshness while online
  is unaffected (network-first). Tests: `sw-update.spec.js` — first install
  never reloads; a simulated update (same scope, new script URL) shows the
  toast, and Refresh swaps the controller with exactly one reload. (No
  `lastUpdated` comparison needed — the waiting-worker state *is* the update
  signal.)
- **P3.4 Install-state detection + dismissal persistence** — ✅ VERIFIED &
  CLOSED (branch `v2-p3.5-manifest`). Confirmed the pieces cohere: the banner
  respects `apdc-install-dismissed` and standalone mode; the header chip hides
  when standalone or when the browser has no install path, and *deliberately*
  survives banner dismissal (quiet affordance vs. one-time nag). Stacking is
  sane (banner z-999 < offline pill z-3000 < update toast z-3001). Locked in by
  a test in `manifest.spec.js`.
- **P3.5 Manifest fixes** — ✅ DONE (branch `v2-p3.5-manifest`). Added
  `"id": "/apdc-competitions/"`. Split the `"any maskable"` combo (which crops
  on launchers) into separate entries: the original art as `purpose: "any"`,
  plus generated `icon-maskable-{192,512}.png` (logo at 78% on the brand
  background, inside the maskable safe zone) as `purpose: "maskable"`. Added
  two `narrow` `screenshots` with labels (hub + schedule, 390×844). Maskable
  icons joined the SW precache; cache bumped to `apdc-v4` (exercises the P3.3
  update flow on deploy); `offline.spec.js` made cache-name agnostic. Fixes
  gap #2. **Completes Phase 3.**

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
