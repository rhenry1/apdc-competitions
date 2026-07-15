# APDC Competition Schedule Portal

A static, offline-capable PWA schedule portal for Amanda Page Dance Company —
no backend, no build step, hosted on GitHub Pages. See `docs/V2-ROADMAP.md`
for the full project history and what's next, or
`docs/ADD-A-COMPETITION.md` for how to add a new competition page.

## Folder structure

```
.
├── index.html                    # Homepage — upcoming/past competitions
├── nationals-2026/                # A competition's schedule page
│   └── index.html                #   (data is embedded directly in the page)
├── regionals-spring-2027/         # Another competition's schedule page
│   └── index.html
├── manifest.json                  # PWA manifest
├── service-worker.js              # Offline precache + network-first fetch
├── 404.html                       # GitHub Pages custom 404
├── og-image.png                   # Social-share preview image
│
├── icons/                         # Favicons, app icons, install screenshots
├── assets/                        # Shared CSS/JS/fonts used by every page
│   └── fonts/                     #   Self-hosted brand font files
│
├── docs/                          # Project docs (roadmap, setup guides)
├── scripts/                       # One-off dev tooling (e.g. data generators)
├── worker/                        # Cloudflare Worker (feedback-widget backend)
├── tests/                         # Playwright test suite
│
├── package.json / package-lock.json
├── playwright.config.js
└── .github/workflows/             # CI (tests) + the feedback-worker deploy
```

## Why some things live where they do

A few of these paths are fixed by convention, not preference — moving them
would break the live site, GitHub Pages, or the PWA:

- `index.html`, `<competition>/index.html`, `manifest.json`,
  `service-worker.js`, `404.html` — must stay where browsers, GitHub Pages,
  and the installed PWA expect to find them. Competition folder names are
  also live, shareable URLs (`/nationals-2026/`) — renaming one breaks
  every link and calendar file already shared for that competition.
- `og-image.png` — referenced by an absolute URL in every page's share
  meta tags; social platforms may have already cached that exact URL.
- `package.json`, `package-lock.json`, `playwright.config.js`,
  `.github/workflows/` — read from fixed locations by npm, Playwright, and
  GitHub Actions respectively.

Everything else (`icons/`, `docs/`, `scripts/`, `worker/`, `tests/`) is free
to reorganize since nothing outside this repo depends on those paths.

## Local development

```bash
npm ci
npm test                  # full Playwright suite (chromium + webkit)
npm run build:noscript    # regenerate the no-JS fallback after editing SCHEDULE
```

No dev server is required to browse the site itself — it's plain static
HTML/CSS/JS. The test suite spins up its own local server.
