# Wave 4 — Native App Feel & Premium Card Design

**Status: IN PROGRESS on the long-lived branch `wave4-native-app-feel`.**
This branch is never merged to `main` mid-flight — it only promotes to `main`
(and the live site) when explicitly approved. Every step below lands as its
own short-lived `wave4-step<N>-<slug>` branch, PR'd into `wave4-native-app-feel`
(not `main`), CI-gated the same as every other change in this repo.

Source: a detailed design brief from the owner (2026-07-17) — "Phase 3:
Native App Feel and Premium Card Design" (13 sections, 18 acceptance
criteria). Named "Wave 4" here instead of "Phase 3" to avoid colliding with
this repo's own already-shipped "Phase 3" (the PWA/offline milestone,
P3.1-P3.5, `docs/V2-ROADMAP.md`).

Pacing: **check in with the owner after each step** (their choice over
building all steps autonomously) — a lot of this spec is subjective visual
taste (exact colors, card treatments, motion feel), and one wrong turn early
should not compound silently through six more steps.

## Full spec summary (see the owner's original brief for verbatim detail)

Goal: make the site feel like a polished native mobile app — elegant, calm,
fast, one-handed-friendly, "luxurious through restraint" — while keeping the
existing dark-purple identity and **not touching schedule functionality or
implying live timing**. Mobile-first; desktop/tablet stay supported.

Implementation order the owner specified (Section 13):
1. **Foundations** — design tokens, background system, typography hierarchy,
   radius/border/shadow/spacing standards.
2. **Card System** — standard + featured card components, convert existing
   schedule/competition cards, interactive states.
3. **App Shell** — header refinement, safe-area support, persistent shell,
   mobile bottom nav (if warranted).
4. **Motion & Interaction** — view transitions, press/hover states, sheet
   transitions, expandable cards, reduced-motion.
5. **Application States** — skeleton loading, empty states, offline feedback,
   toasts.
6. **PWA Polish** — manifest, icons, theme/background alignment, no
   launch-white-flash, standalone mode.
7. **Quality Assurance** — mobile Safari, Android Chrome, desktop, keyboard,
   screen reader, performance, visual consistency.

Non-goals (explicit): live competition timing, push notifications, user
accounts, backend auth, real-time sync, venue maps, new data sources, or any
change implying live accuracy beyond scheduled times.

## Step 1 — Foundations: STATUS

**Shipped to `wave4-native-app-feel`** (not `main`).

- **Design tokens** (`assets/tokens.css`): added a full Wave 4 token set —
  purely additive, every existing token (`--color-bg`, `--purple`, `--space-4`,
  etc.) is untouched, so nothing visually changes until a component is
  deliberately migrated in a later step. New tokens cover: surface hierarchy
  (`--color-surface-featured` for the spec's "Level 3" cards, `--color-bg-elevated`
  for future header/nav chrome), card radii (`--radius-card-lg/md/sm/btn`
  matching the spec's 22-28/18-22/14-18/12-16px ranges), card shadows
  (`--shadow-card`, `-elevated`, `-featured`), glass blur (`--blur-glass:
  16px`), an extra spacing step (`--space-7: 28px` for large card padding),
  motion (`--duration-fast/standard/modal`, `--ease-premium`), a typography
  hierarchy scale for card content (eyebrow/primary-value/secondary-detail/meta),
  and a z-index scale.
- **Background system** (`assets/app-shell.css`, new file): one shared
  `.app-bg` fixed decorative layer, replacing three slightly different
  bespoke gradients (the homepage's old `.bg` div, the schedule pages'
  `body` background-image) with a single calmer recipe — lower opacity,
  positioned off-viewport-left like the original so it doesn't wash out
  header text, `z-index: -1` so no other element needs its own z-index to
  paint above it. Linked from all three pages; `<div class="app-bg">` is the
  first thing inside `<body>` on each.
- **Typography hierarchy**: established as tokens only (not yet applied
  broadly — that's Step 2's job when components actually migrate to the new
  card system).
- **Accessibility regression found and fixed**: the calmer background
  exposed that `.overline` and `.studio-name` on the homepage (translucent
  lilac text, `rgba(196,181,253, 0.4/0.5)`) only passed WCAG AA contrast
  *because* the old, brighter gradient happened to sit behind them — a
  hidden, accidental dependency. Fixed both to the opaque, already-audited
  `--color-text-subtle` token (W3.6) instead of chasing another translucent
  value by trial and error; same lilac family, contrast no longer depends on
  whatever happens to render behind it.
- **Service worker**: `assets/app-shell.css` added to the precache list;
  `CACHE` bumped to `apdc-v9`.
- Verified: full local Playwright suite (chromium) green (194/194), axe scan
  clean on all three pages, visual screenshots reviewed at mobile viewport.

**Owner review: approved ("Looks good") 2026-07-17.**

## Step 2 — Card System: STATUS

**Shipped to `wave4-native-app-feel`** (not `main`).

This site already had the two card archetypes the spec asks for; Step 2 is
about applying the new depth hierarchy and tokens to them, not building from
scratch:

- **`.routine-card`** (schedule pages, `assets/schedule-theme.css`) — the
  spec's "Level 1 / base surface, standard card." Moved from `--radius-md`
  (12px) to `--radius-card-sm` (16px, within the spec's compact-card range
  given how many of these render on one screen), from `--shadow-sm`/`-md` to
  `--shadow-card`/`-card-elevated` (adds the subtle inset top highlight from
  §4.3), padding unified to `--space-5` (was an asymmetric 16/16/16/20).
  Added a hover lift (`translateY(-1px)`, guarded to `@media (hover: hover)`
  so it can't get stuck on touch) and a press scale (`0.995`) per §4.12 —
  decorative only, since the card's actual tap targets are the
  share/calendar/favorite buttons already inside it, which keep their
  existing states. `.card-action-btn` radius moved to `--radius-card-btn`
  (14px, the spec's 12-16px "buttons inside cards" range).
  `body.compact .routine-card`'s own padding/shadow overrides (already a
  reasonable compact-card treatment per §4.16) were left as-is.
- **`.next-hero`** (homepage, `index.html`) — already this site's "Level 3 /
  featured surface" card (next-competition countdown, gradient background,
  left accent bar) before Wave 4 even started. Bumped to `--radius-card-lg`
  (24px) and `--shadow-card-featured` (a richer, more elevated shadow), added
  a hover lift + press scale matching the routine cards. Deliberately did
  **not** turn `.comp-row` (the plain list rows for every other competition)
  into cards of their own — §4.5 says only one or two featured cards per
  viewport, and §4.16 says dense lists should avoid oversized card treatment;
  this site's existing "one hero, plain rows for the rest" pattern already
  matches that intent.
- New test: `tests/design-system.spec.js` — `.app-bg` is a shared fixed
  layer across all three pages (Step 1 carryover, added here).
- Verified: full local Playwright suite (chromium) green (197/197), axe scan
  clean, visual screenshots reviewed at mobile viewport (homepage hero card,
  routine card list).

Deferred to a later pass, not in scope for this slice: the badge system
overhaul (§4.9 — existing tags/badges work and aren't broken), expandable
cards (§4.14, a "may" not a "must"), and reordering routine-card content to
match the spec's exact 1-6 order (§4.10 — currently very close already:
number → title → tags → dancer name → actions; the spec's ordering puts
dancer name before the stage/type tags, a cosmetic swap not worth a separate
step on its own).

**Owner review: approved 2026-07-17, go-ahead given for Step 3.**

## Step 3 — App Shell: STATUS

**Shipped to `wave4-native-app-feel`** (not `main`).

- **Safe-area audit (§3.2)**: the schedule pages already had `env(safe-area-inset-*)`
  handling for `header`/`.filter-bar`/`main`, but only inside a
  `@media (max-width: 480px)` block — which covers essentially every phone
  in *portrait*, but not landscape (a landscape iPhone is comfortably wider
  than 480px logical pixels while still having a real side inset from the
  notch/rounded corner). Moved the `env(safe-area-inset-left/right)` handling
  for `header`, `.filter-bar`, and `main` to the base (unconditional) rules
  so it applies regardless of orientation or viewport width; `max(Npx, env(...))`
  is always safe to apply since it's simply `0` on devices without an inset.
  Also added the same left/right handling to `.filter-extra-inner` and
  `.filter-drawer-header` (the filter bottom sheet spans full width by
  design) and to `.sample-banner`, and gave the homepage's `.wrap` the same
  treatment (it previously had no safe-area handling at all).
- **Header refinement (§3.3)**: the schedule pages' `<header>` moved from a
  fully opaque gradient fill to a translucent one, letting the shared
  `.app-bg` ambient gradient tint through faintly — a small step toward the
  "layered surface" look without adding a `backdrop-filter` that would have
  no real content to blur (the header isn't sticky, so nothing distinct ever
  scrolls behind it — that would have been performance cost for zero visual
  gain). The existing sticky `.schedule-toolbar` (filter/offset controls,
  already `backdrop-filter: blur(20px)` + translucent) already satisfies the
  spec's "stays reachable and readable while scrolling" requirement; a
  scroll-direction-based shrink/restore header animation was in the spec as
  an explicit "optionally" and is deferred rather than added as new
  behavioral complexity on top of a pattern that already works.
- **Bottom navigation (§3.4) — deliberately not built.** The spec says to
  add this "if the site has multiple primary destinations" and lists
  Home/Schedule/Dancers/Events/More as *examples*. This site doesn't
  actually have that structure: there's the homepage (a list of
  competitions) and each competition's own schedule page — no separate
  Dancers or Events sections exist to link to. A bottom nav here would mean
  either fabricating destinations that don't exist yet or duplicating
  Home/Back links that already work as plain in-page controls, which cuts
  against the spec's own §2.2 ("avoid decorative elements that compete with
  content") and §2.3 ("information first"). Flagging this explicitly rather
  than silently skipping it — if there's a concrete destination in mind
  (e.g. a future "Favorites" or "Dancers" view) that would make a bottom nav
  genuinely useful, that's worth a dedicated discussion rather than
  retrofitting one in.
- **Persistent content shell / page padding (§3.1)**: reviewed the homepage
  (620px max-width, 28px side margins, list-style content) against the
  schedule pages (960px max-width, 16px side margins, dense grid-card
  content) — left these as they are. They're different content types with
  already-coherent internal rhythms; forcing identical numbers would mean
  reworking the homepage's several hardcoded `-28px` accent-bar offsets for
  no real user-facing benefit, and "consistent" in the spec's own words
  means a coherent design language, not pixel-identical margins across
  fundamentally different layouts.
- Verified: full local Playwright suite (chromium) green (195/197 on the
  first run — the 2 failures were `data-model.spec.js` and
  `deep-links.spec.js`, both unrelated to this change and confirmed as this
  sandbox's known CPU-contention flakes by re-running just those two files
  in isolation, where both passed). Visual screenshots reviewed at mobile
  portrait and landscape viewports.

**Owner review: go-ahead given for Step 4.**

## Step 4 — Motion & Interaction: STATUS

**Shipped to `wave4-native-app-feel`** (not `main`).

- **View transitions (§3.5)**: added `@view-transition { navigation: auto; }`
  (the standards-track cross-document View Transitions API) to
  `assets/app-shell.css`, so navigating between the homepage and a
  competition's schedule page gets a brief crossfade instead of a hard cut.
  This is a pure progressive enhancement — browsers that don't support the
  `@view-transition` at-rule (Safari, Firefox as of this writing) simply
  ignore it and navigate exactly as they do today, no feature-detection or
  fallback code needed. Customized only the root crossfade's duration/easing
  (to the Wave 4 tokens) — not its fade-only nature — deliberately staying
  away from the spec's "avoid large swipes / zoom / bounce" warning for
  page-level motion. Scoped inside `@media (prefers-reduced-motion:
  no-preference)` so a reduced-motion user never gets it, layered on top of
  whatever a supporting browser already does for that setting on its own.
- **Card press/hover states (§4.12)**: already done in Step 2.
- **Bottom-sheet transitions (§3.6)**: the filter drawer's slide + backdrop
  fade already existed; moved both off a hardcoded `0.28s
  cubic-bezier(0.4,0,0.2,1)` (which was, digit for digit, the Wave 4
  `--ease-premium` curve already) onto `var(--duration-modal)` /
  `var(--ease-premium)` — the "large modal" end of the spec's timing
  guidance, since this sheet is the single biggest overlay on the site.
- **Reduced-motion (§3.5, §7)**: already covered globally since P1.1
  (`assets/tokens.css` collapses all animation/transition durations to
  ~0 under `prefers-reduced-motion: reduce`) — the new view-transition
  opt-in adds a second, belt-and-suspenders layer on top of that for this
  specific feature.
- **Expandable cards (§4.14) — deliberately not built.** This is a "may,"
  not a "must," and there's no unshown information on a routine card to
  expand *into* — number, title, dancers, tags, time, and actions are all
  already visible. Building an expand/collapse interaction here would mean
  inventing a reason for it (e.g. manufacturing a "details" section) rather
  than solving a real information-density problem, which cuts against
  §2.1's "avoid unnecessary" guidance.
- New test: `tests/design-system.spec.js` — the view-transition opt-in
  stays scoped to `prefers-reduced-motion: no-preference`.
- Verified: full local Playwright suite (chromium) green (198/198, no
  flakes this run).

**Owner review: go-ahead given for Step 5.**

## Step 5 — Application States: STATUS

**Shipped to `wave4-native-app-feel`** (not `main`).

This step turned out smaller than the others by design: skeleton loading
(§3.12), empty states (§3.13), and offline feedback (§3.14) were all already
built in earlier waves (R3, P1.8, P3.2/P3.3 respectively) — auditing them
against the Wave 4 spec found they already meet it:

- **Skeleton loading**: `.skel-card`/`.skel-day` already approximate the
  final layout, use a subtle shimmer (already reduced-motion-guarded), and
  reserve layout space so nothing shifts when real content arrives. Only
  change: `.skel-card`'s radius now explicitly tracks `--radius-card-sm`
  (the same value it already resolved to via the old `--radius-lg` token —
  no visual change, but it now stays in sync if the routine card's radius
  ever moves again).
- **Empty states** (`.no-results` / `.empty-icon/-title/-msg/-actions`):
  already has a concise title ("No routines match"), a short explanation,
  one clear next action ("Clear all filters"), and a subtle accent (the
  purple-tinted icon pill) — matches §3.13 point for point already, so
  nothing needed changing here. Screenshot attached for the owner's
  reference.
- **Offline feedback**: the offline pill already explains staleness
  ("Offline — showing saved schedule"), and the service worker's
  network-first strategy already means the moment connectivity returns, the
  very next fetch gets fresh data automatically — no separate "reconnect"
  logic needed.
- **Toast/confirmation feedback**: tokenized the three toast/pill
  components' transitions (`.action-toast`, `.offline-indicator`,
  `.update-toast`/`.update-refresh`) from ad hoc `0.2s`/`0.25s ease` onto
  `--duration-fast`/`--ease-premium`, matching the timing language used
  everywhere else in Wave 4. Visually identical (180ms vs. 200-250ms isn't
  perceptible) — this is about one consistent motion vocabulary across the
  site, not a user-facing change.
- Verified: full local Playwright suite (chromium) green (198/198, no
  flakes this run). Empty-state screenshot reviewed at mobile viewport.

## Steps 6-7

Not started. Each will get its own section here as it lands, following the
same pattern: what shipped, why, how it was verified, screenshots for the
owner's review.
