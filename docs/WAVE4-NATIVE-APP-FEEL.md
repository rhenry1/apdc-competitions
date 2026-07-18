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

**Owner review: go-ahead given for Step 6.**

## Step 6 — PWA Polish: STATUS

**Shipped to `wave4-native-app-feel`** (not `main`).

Most of §3.11 was already solid — `manifest.json` already has a stable
`id`, correct `start_url`/`scope`, `display: standalone`, a
`background_color`/`theme_color` that both already match the app
background (`#06041a`), split any/maskable icons, and store-style
screenshots. All three pages already consistently set
`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style:
black-translucent`, an apple-touch-icon, and the manifest link. The audit
found two real, concrete gaps rather than needing a rebuild:

- **White flash on launch.** The homepage has
  `<html style="background:#06041a;">` inline — painted before any
  stylesheet loads over the network, so first paint is already dark. The
  two schedule pages didn't have this; they relied entirely on
  `schedule-theme.css` loading first. Since a shared/deep-linked competition
  page (not the homepage) is the more likely install or launch target,
  this was the actual gap the spec's "no white flash" requirement was
  pointing at. Added the same inline style to both.
- **Inconsistent home-screen label.** Without `apple-mobile-web-app-title`,
  iOS falls back to whatever the page's `<title>` happens to be when
  someone taps "Add to Home Screen" — which differs across all three pages
  (e.g. "APDC Competition Schedule — Sample" for regionals). Added
  `apple-mobile-web-app-title` and `application-name` (both `"APDC"`,
  matching the manifest's `short_name`) to all three pages, so the
  home-screen icon reads the same regardless of which page someone
  installed from.
- Bumped the service worker's `CACHE` to `apdc-v10` (precached HTML content
  changed), matching this repo's established convention.
- New tests in `tests/manifest.spec.js`: `<html>` paints the app background
  before any CSS loads (all three pages), and the home-screen title
  metadata is present and consistent (all three pages).
- Verified: full local Playwright suite (chromium) green (204/204, no
  flakes this run).

**Owner review: go-ahead given for Step 7 (final step).**

## Step 7 — Quality Assurance: STATUS

**Shipped to `wave4-native-app-feel`** (not `main`). This is the final step
— see the acceptance-criteria review and the honest-limits section below
before deciding whether to promote this branch to `main`.

### Bug found and fixed during this pass

**`.livestream-bar` stretched edge-to-edge on desktop.** It's a direct
sibling of `<main>` rather than nested inside it, so unlike literally every
other content band on the schedule pages (header, filter bar, offset bar,
main) it had no `max-width` — on desktop viewports (checked at 1440px) it
spanned the full browser width while everything else stayed inside the
shared 960px column, which is exactly the "resembles an admin dashboard"
look §6.3 explicitly warns against. This is a pre-existing bug (present
since R4 shipped the livestream card, unrelated to anything Wave 4 touched
before this) that a dense-content mobile viewport would never reveal — it
only shows up on a wide desktop window, which is precisely what this step's
"desktop testing" / "visual consistency review" checks were for. Fixed by
giving it the same `max-width: 960px; margin: 0 auto;` + safe-area side
padding recipe `.filter-bar` already uses, so it now lines up exactly with
the routine cards below it. New regression test in
`tests/design-system.spec.js`.

### What I could verify from this sandbox

- **Full regression suite**: 205 tests × chromium, green (a couple of
  unrelated flakes on full-suite runs, confirmed passing in isolation each
  time — this sandbox's known CPU-contention pattern, documented
  throughout this project).
- **Accessibility**: `axe-core` scan (WCAG 2.0/2.1 A+AA) clean on all three
  pages; existing hand-written a11y checks (headings, labels, live regions,
  skip link, focus trapping) all green.
- **Keyboard navigation**: covered by existing tests (filter drawer focus
  trap/Escape/restore-focus, skip link) — nothing in Wave 4 added new
  interactive elements that need new keyboard support; the hover/press
  states added in Step 2 are pointer-gated (`@media (hover: hover)`) so they
  don't affect keyboard or touch users at all.
- **Reduced motion**: verified globally (P1.1's site-wide neutralizer) and
  specifically for the Step 4 view-transition opt-in (explicitly scoped to
  `no-preference`).
- **Visual consistency**: screenshotted all three pages at 390/430/768/1024/1440px
  (the same breakpoint set R5 established) — no horizontal overflow at any
  width on any page, confirmed via `document.documentElement.scrollWidth`.
  This is what surfaced the livestream-bar bug above.
- **Backdrop-filter usage**: exactly one use site-wide (`.schedule-toolbar`,
  20px blur on a small sticky bar) — well within §4.4's 12-24px guidance and
  nowhere near a large scrolling region.
- **Basic load timing**: page-load/FCP timings via the Performance API,
  sanity-checked as "nothing catastrophically slow was added" — not a real
  performance profile (see limits below).

### What I could NOT verify — real-device testing is still needed

This sandbox has no physical iPhone, no physical Android device, and no
screen reader to drive. Being direct about this rather than claiming
coverage I don't have:

- **Real Mobile Safari.** Playwright's `webkit` project (used in CI)
  approximates Safari's rendering/JS engine but is not Safari on iOS — it
  has no floating/compact toolbar chrome, no real back/forward cache, no
  real `env(safe-area-inset-*)` values from an actual notch. Every real bug
  found earlier in this project (the toolbar-clipping issue, the bfcache
  stale-paint issue) was caught from a screen recording on an actual phone,
  not from any automated test. The same is true here: I cannot confirm the
  safe-area fixes, the header treatment, or the card interactions actually
  look and feel right on a real iPhone.
- **Real Android Chrome.** Not tested at all — this project has never had
  access to a real Android device or Android-specific emulation.
- **Real screen readers** (VoiceOver, TalkBack). `axe-core` catches a lot of
  the same underlying issues, but it's a static analysis, not a person
  actually navigating with a screen reader — subtleties like reading order,
  verbosity, and gesture navigation aren't things it can check.
- **Real performance profiling** (Lighthouse, real network throttling, a
  real mid-range phone's CPU). The timing numbers above are this sandbox's
  local loopback server with no network latency and a desktop-class CPU —
  not representative of a real mobile connection or device.

**Recommendation:** before promoting `wave4-native-app-feel` to `main`, do
a hands-on pass on an actual iPhone (Safari) covering: opening/closing the
filter drawer, scrolling through a full day's schedule, installing the PWA
and relaunching it, and navigating between the homepage and a schedule page
to see the view-transition crossfade. If anything looks or feels off,
report it the same way as before (a screenshot or screen recording is far
more effective here than a description) and I'll fix it before this goes
live.

### Acceptance criteria (spec §12) — status

1. Mobile site feels like a cohesive app — addressed (Steps 1-6); final
   judgment is the owner's on a real device.
2. Existing schedule functionality intact — verified, full suite green
   throughout every step.
3. Primary pages share a consistent app shell — done (Steps 1, 3).
4. Safe-area spacing works on modern iPhones — fixed and audited (Step 3);
   **not verified on a real notched device.**
5. All cards use the new shared card system — done for the two card
   archetypes that exist (routine card, featured hero); badges/smaller
   components deliberately deferred (documented in Step 2).
6. Featured vs. standard hierarchy is clear — done (Step 2).
7. Interactive card states (press/hover/focus) are polished — done (Step 2;
   focus states were already solid from earlier waves).
8. Page/modal transitions feel smooth and restrained — done (Step 4).
9. Loading/empty states match the premium language — done (Step 5; mostly
   already there from earlier waves).
10. Installed PWA uses APDC branding, no launch white flash — fixed
    (Step 6); **the white-flash fix itself hasn't been confirmed on a real
    installed PWA.**
11. No live-timing claims — unaffected; the existing guardrail test still
    passes.
12. Readable and accessible — axe-clean throughout; **no real screen-reader
    pass.**
13. Reduced-motion respected — verified.
14. Scrolling remains smooth on mobile — no heavy blur/scroll-jacking
    added; **not verified on a real device's actual scroll performance.**
15. No broken links/filters/schedules/competition pages — verified, full
    suite green.
16. Reusable tokens/components used instead of duplicated styles — done
    (Step 1 tokens used consistently through Steps 2-6).
17. Mobile/tablet/desktop layouts pass visual review — done; this pass
    specifically is what caught and fixed the livestream-bar bug above.
18. Tested in Safari iOS, Chrome Android, and desktop — **partial.**
    WebKit/Chromium in CI approximate the two mobile engines but aren't the
    real thing; desktop Chromium testing is real and thorough.
