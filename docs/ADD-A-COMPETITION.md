# Adding a new competition

A quick runbook for adding another competition page (e.g. next year's
Nationals, or a new Regionals). No build step, no backend — everything is a
static file you edit directly.

## 1. Copy an existing page as a template

`regionals-spring-2027/` is the simpler of the two existing pages (fewer
days, no livestream) and is the best starting template:

```bash
cp -r regionals-spring-2027 my-new-competition-2027
```

The folder name becomes the public URL segment
(`/apdc-competitions/my-new-competition-2027/`), so keep it lowercase,
hyphenated, and permanent once shared — renaming it later breaks every link,
calendar file, and bookmark already handed out for that competition.

## 2. Edit `COMPETITION_CONFIG` and `SCHEDULE` in the new `index.html`

Both are plain JS object literals near the bottom of the file, inside a
`<script>` tag — no separate data file. Update:

- `COMPETITION_CONFIG`: `id` (matches the folder name), `name`, `type`
  (`"Nationals"` / `"Regionals"` / etc.), `season`, `status`
  (`"upcoming"` / `"past"`), `startDate`/`endDate` (`YYYY-MM-DD`,
  inclusive), `location`, `dates` (display string), `livestream` (leave
  `url`/`password` empty if none), `resources`, `lastUpdated`, `days` (one
  entry per day key used in `SCHEDULE`), and `dayButtons` (the filter bar's
  day chips, in schedule order).
- `SCHEDULE`: one array per day key from `days`. Each entry is either
  `{ type: 'routine', ... }` (a performance — see any existing entry for the
  full field list: `entry`, `title`, `time`, `level`, `format`, `studio`,
  `dancers`, `style`, `stage`, `formatTag`, `ageLabel`, etc.) or
  `{ type: 'meta', text: "..." }` (a non-routine schedule line like "Doors
  Open" or an awards break).

Also update the page's `<title>`, `<meta name="description">`,
`og:title`/`og:url`/`twitter:*` tags, and the `<link rel="canonical">` — they
still point at the template's URL after copying.

## 3. Register it in `assets/competitions.js`

Add an entry to the `COMPETITIONS` array — this is what drives the homepage's
cards, countdown, and upcoming/past sorting. Keep the public fields (`name`,
`type`, `season`, `status`, `startDate`, `endDate`, `dates`, `city`, `state`)
in sync with the page's own `COMPETITION_CONFIG`. Set `url` to
`my-new-competition-2027/` (matching the folder). Only set `sample: true` if
this is placeholder/demo data rather than a real published schedule.

## 4. Wire it into the offline shell

In `service-worker.js`, add the two new page paths to the `ASSETS` precache
list (`BASE + '/my-new-competition-2027/'` and
`BASE + '/my-new-competition-2027/index.html'`), then bump the `CACHE`
version string so existing installs pick up the change.

## 5. Add it to `sitemap.xml`

Add a `<url>` entry with the production URL and today's date as `lastmod`.

## 6. Generate the no-JS fallback

```bash
npm run build:noscript
```

Regenerates the static `<noscript>` schedule listing for every competition
page (including the new one) straight from its own `COMPETITION_CONFIG`/
`SCHEDULE`, so it can never drift out of sync. `npm run check:noscript`
verifies this in CI — it fails the build if the fallback is stale.

## 7. Update the test suite

Several Playwright specs iterate over a hardcoded list of page paths (search
`tests/` for `nationals-2026` to find them — `meta.spec.js`,
`axe-scan.spec.js`, `schedule.spec.js`, `data-model.spec.js`, and others).
Add the new page's path alongside the existing two so it gets the same
coverage. Then run the full suite:

```bash
npm test
```

## Notes

- If `W3.3` (moving `SCHEDULE`/`COMPETITION_CONFIG` to JSON with validation)
  ships later, most of steps 2 and 7 get simpler or disappear — this doc will
  need a pass at that point.
- Real schedule data usually isn't final until close to the event; it's fine
  to publish a page early with `status: "upcoming"`, empty `livestream`, and
  a partial `SCHEDULE`, then fill it in as details firm up.
