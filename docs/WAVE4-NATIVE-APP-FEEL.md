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

## Steps 3-7

Not started. Each will get its own section here as it lands, following the
same pattern: what shipped, why, how it was verified, screenshots for the
owner's review.
