# Zine

A personal manga reader with an editorial, print-zine design language.
React 19 + Vite + Tailwind CSS v4 + motion, backed by the official public
[MangaDex REST API](https://api.mangadex.org/docs/).

## Getting started

```sh
npm install
npm run dev
```

To develop without network access to MangaDex (or to get reproducible data
for every UI state), run against the built-in fixtures:

```sh
VITE_USE_FIXTURES=1 npm run dev
```

## Features

- **Discover** — title search with load-more pagination, skeleton loaders,
  empty/error states.
- **Detail page** — magazine-spread hero with blurred cover backdrop,
  shared-element cover transition, favorite, expandable description; chapter
  list as a spine rail with language filter, sort, collapsible volume
  grouping, scanlation-dedupe with expandable version chips, read ticks,
  unread filter, and external-chapter handling.
- **Reader** — paged and vertical (webtoon) modes; fit width/height/original;
  RTL/LTR; tap zones, keyboard shortcuts, tick-rail scrubber; chapter
  prev/next with an end-of-chapter countdown interstitial; fullscreen;
  auto-hiding chrome; data saver; smart page preloading with expiry-aware
  refetch; **autoplay** with a user-set timer, progress ring, and smooth
  auto-scroll in vertical mode; in-reader quick settings sheet.
- **Library** — favorites, continue-reading shelf with progress bars,
  reading history, per-manga resume.
- **Personalization** — six theme presets with live swatches, custom
  background upload (stored in IndexedDB) with blur/dim/fit controls,
  reader defaults, language and content-rating filters, clear-data controls.

### Keyboard shortcuts (reader)

| Key | Action |
| --- | --- |
| `←` / `→` | Turn page (honors reading direction) |
| `Space` | Play/pause autoplay |
| `,` / `.` | Autoplay timer −/+ |
| `M` | Toggle paged/vertical mode |
| `F` | Fullscreen |
| `Esc` | Back to the series page |

## Project layout

```
src/
  api/        mangadex.js (real client) · fixtures.js · index.js (switcher)
  lib/        themes.js · chapters.js (dedupe/grouping) · preload.js · backgroundStore.js
  store/      useSettings.js · useLibrary.js · useToasts.js · chapterCache.js
  hooks/      useChapters · useAutoplay · useMangaSearch · useKeyboard · useFullscreen · useObjectUrl
  components/ layout, cards, chapter rows, ui/ primitives, reader/ components
  pages/      HomePage · MangaPage · ReaderPage · SettingsPage · NotFoundPage
scripts/      node verification scripts (see below)
```

## Deploying

### GitHub Pages (built in)

`.github/workflows/deploy.yml` builds and publishes automatically on every
push to `main`. One-time setup: repo **Settings → Pages → Source →
"GitHub Actions"**. The workflow bakes the `/<repo>/` base path into the
build (`VITE_BASE`), and the post-build step emits `404.html` +
`.nojekyll` so deep links (`/manga/:id`) survive Pages' lack of SPA
rewrites. Using a custom domain or a `<user>.github.io` root repo? Set
`VITE_BASE: /` in the workflow.

### Cloudflare Pages / Netlify / Vercel

Also works as-is: build command `npm run build`, output directory `dist`,
no `VITE_BASE` needed (they serve from the root and support SPA fallback).

## Interface layout

The app picks mobile (bottom app navigation) or desktop (header
navigation) chrome automatically from pointer type + viewport width, and
re-evaluates live on rotation/resize. Settings → Appearance → *Interface
layout* can force either one.

## Theming

Theme colors are CSS variables defined per `[data-theme=...]` block in
`src/index.css`, mapped into Tailwind via `@theme inline` so utilities like
`bg-surface` emit live `var()` references and repaint instantly on theme
switch. An inline script in `index.html` applies the persisted theme before
first paint. Add a theme by adding a variable block in `index.css` and an
entry in `src/lib/themes.js`.

## Verification

```sh
npm run lint && npm run build
node scripts/check-mangadex.mjs      # API client: pagination loop, deep-link fallback
node scripts/check-chapters-lib.mjs  # dedupe/canonical/volume-grouping/prev-next rules
node scripts/check-autoplay.mjs      # autoplay stepper + preload window math
```

## Local shelf (offline, no server)

**Library → On device → Import** accepts `.cbz`/`.zip` chapter archives or
loose image files. Imports are stored in the browser's IndexedDB and read
with the full reader (autoplay included) with zero network involved — they
survive reloads and work when MangaDex and the relays are unreachable.
Each archive becomes one chapter (pages in natural filename order); more
chapters can be added from the series page, which also has
"Remove from device". Local series never touch any server, and the app
never bundles or distributes manga content itself — you import your own
files.

## MangaDex API and CORS (hosted deployments)

MangaDex's API does not send CORS headers for third-party origins, so a
hosted Zine (GitHub Pages, Cloudflare, …) can't call it directly from the
browser. Zine handles this automatically — **no setup required**:

1. **Built-in relay failover (default)** — when a direct call CORS-fails,
   the client routes through a chain of public relays (allorigins.win →
   corsproxy.io → codetabs.com), remembers whichever one answers, and stops
   re-trying the blocked direct path for the session. A genuine MangaDex
   error (like a 404) passing through a relay is surfaced as-is, never
   retried across relays.
2. **Personal proxy (optional)** — if the public relays ever feel slow, any
   server that forwards requests to `api.mangadex.org` can be set as
   **Settings → Content → API proxy**. A ready-made one-file worker ships in
   `cors-proxy/worker.js` (deployable on Cloudflare's free tier), but
   nothing in Zine requires it.

Images (covers, chapter pages) are unaffected — they load as plain `<img>`
elements, which browsers don't subject to CORS.

## MangaDex API notes

- Page URLs from `/at-home/server` expire (~15 min): the reader refetches
  transparently on staleness or image error.
- Covers must be rendered with `referrerPolicy="no-referrer"` —
  `uploads.mangadex.org` rejects foreign referrers.
- The API allows ~5 req/s per IP; the full-feed fetch paces itself and 429s
  surface as typed `MangaDexError`s.
