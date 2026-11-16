# Zine

A personal manga reader with an editorial, print-zine design language.
React 19 + Vite + Tailwind CSS v4 + motion, backed by the official public
[MangaDex REST API](https://api.mangadex.org/docs/).

> **Reading online from the hosted site currently needs a personal API
> proxy.** MangaDex does not allow browser calls from other origins, and as
> of 2026-11 it answers the public relay Zine used as a fallback with a bot
> check. See [MangaDex API and CORS](#mangadex-api-and-cors-hosted-deployments).
> The local shelf (your own imported files) works without any of that.

## Getting started

```sh
npm install
npm run dev
```

To develop without network access to MangaDex (or to get reproducible data
for every UI state), run against the built-in fixtures:

```sh
VITE_USE_FIXTURES=1 npm run dev            # bash
$env:VITE_USE_FIXTURES = '1'; npm run dev  # PowerShell
```

(or copy `.env.development.example` to `.env.development`).

## Features

- **Discover** — title search with type-ahead suggestions, load-more
  pagination, skeleton loaders, empty/error states; "trending now." and
  "most popular." rails before you search. The search lives in the address
  bar (`/?q=…`), so Back from a series returns to your results, a search
  can be reloaded or shared, and "Browse" takes you back to the rails.
- **Detail page** — magazine-spread hero with blurred cover backdrop,
  favorite, expandable description; chapter list as a spine rail with
  language filter, sort, collapsible volume grouping, scanlation-dedupe
  with expandable version chips, read ticks, unread filter, and
  external-chapter handling. The language picker always shows the language
  the list was loaded for, marked `· none` when the series has nothing in
  it.
- **Reader** — paged and vertical (webtoon) modes; fit height / width /
  original / Fill (full width, scrolls) / Book (two-page spread in
  landscape, one full page in portrait); RTL/LTR; tap zones, keyboard
  shortcuts, tick-rail scrubber (a slider on phones and long chapters);
  chapter prev/next with an end-of-chapter countdown interstitial;
  fullscreen; chrome that auto-hides after 4s; data saver; page preloading
  with expiry-aware refetch; **autoplay** with a user-set timer, smart
  per-page timing, progress ring, and smooth auto-scroll in vertical mode;
  in-reader quick settings sheet. A page image that still fails after one
  automatic re-fetch is shown as a failure with a "Try again", not as a
  broken-image icon.
- **Library** — favorites, continue-reading shelf with progress bars,
  reading history, per-manga resume, and the on-device shelf (below).
- **Personalization** — six theme presets with live swatches, custom
  background upload (stored in IndexedDB) with blur/dim/fit controls,
  reader defaults, language and content-rating filters, clear-data
  controls, and a connection doctor.

### Keyboard shortcuts (reader)

| Key | Action |
| --- | --- |
| `←` / `→` | Paged: turn page (honors reading direction). Vertical: scroll back / forward most of a screen |
| `↑` `↓` `PgUp` `PgDn` `Home` `End` | Vertical: scroll the strip (native) |
| `Space` | Play/pause autoplay |
| `,` / `.` | Autoplay timer −/+ |
| `M` | Toggle paged/vertical mode |
| `Z` | Toggle Fill fit |
| `F` | Fullscreen |
| `Esc` | Close the settings sheet or the next-chapter countdown; otherwise back to the series page |

Shortcuts never fire with Ctrl, Alt or ⌘ held (find-in-page and browser
back/forward keep working). Space and Enter go to a control you reached
with Tab; after a mouse click or tap, Space is still play/pause.

## Project layout

```
src/
  api/        mangadex.js (client) · corsFetch.js (direct → relay pipeline) ·
              comick.js · jikan.js · searchStream.js · fixtures.js · index.js (router)
  lib/        chapters.js (dedupe/grouping) · stripPosition.js (vertical-mode geometry) ·
              preload.js · pageTiming.js · localLibrary.js · backgroundStore.js ·
              diagnostics.js · themes.js
  store/      useSettings.js · useLibrary.js · persistedState.js + guardedPersist.js
              (validate saved data on load) · useToasts.js · chapterCache.js
  hooks/      useChapters · useAutoplay · useMangaSearch · useSuggestions · useKeyboard ·
              useFullscreen · useLayoutMode · useOrientation · useObjectUrl
  components/ layout, cards, chapter rows, ErrorBoundary, ui/ primitives, reader/ components
  pages/      HomePage · MangaPage · ReaderPage · SettingsPage · NotFoundPage
scripts/      node check scripts + browser smoke suites (see Verification)
cors-proxy/   one-file personal API proxies (Cloudflare, Deno, Vercel, Netlify)
```

## Deploying

### GitHub Pages (built in)

`.github/workflows/deploy.yml` builds and publishes on every push to the
repository's default branch (and to `main`, if the repo is ever switched
to it). One-time setup: repo **Settings → Pages → Source → "GitHub
Actions"**. The workflow bakes the `/<repo>/` base path into the build
(`VITE_BASE`), and the post-build step emits `404.html` + `.nojekyll` so
deep links (`/manga/:id`, `/read/…`) and reloads on them boot the app
despite Pages' lack of SPA rewrites — Pages answers those with HTTP 404
and the app takes over. Using a custom domain or a `<user>.github.io` root
repo? Set `VITE_BASE: /` in the workflow.

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

## Saved data

Everything is stored in the browser, per origin; nothing is sent anywhere.

| Where | Key | What |
| --- | --- | --- |
| localStorage | `zine-settings` | theme, layout, reader defaults, languages, ratings, API proxy |
| localStorage | `zine-library` | favorites, reading progress, read marks, history (50) |
| IndexedDB | `zine:local:index`, `zine:local:pages:<chapter>` | the on-device shelf |
| IndexedDB | `zine:bg` | custom background image |
| sessionStorage | `zine:relay-state-v2` | which relay last worked, per source |

Saved settings and library are validated when they are loaded
(`src/store/persistedState.js`). A setting that did not exist when you last
saved takes its default; a value that cannot be used falls back to its
default (settings) or is dropped (one library entry, never a whole
section). Whenever that happens a notice says what was reset — nothing is
repaired silently — and a render error anywhere shows an error page with
Reload / Back to browse instead of a blank screen. There is no
export/import yet: clearing site data clears the library.

## Verification

```sh
npm run lint
npm test          # every scripts/check-*.mjs (node:assert, no framework)
npm run build
```

`npm test` runs: the MangaDex client (pagination loop, relay failover,
cooldowns, cache), the Comick client, streaming search merge, chapter
dedupe/grouping/prev-next, the autoplay stepper and preload window, smart
page timing, local-shelf import parsing, the library store (including the
end-of-chapter regression), saved-data validation and migration, the
keyboard shortcut gate, and vertical-mode strip geometry.

Two browser suites live in `scripts/browser/`. They need Playwright with
Chromium (not a dependency of this project) and a fixtures build or dev
server:

```sh
VITE_USE_FIXTURES=1 npm run dev -- --port 5173
SMOKE_BASE=http://localhost:5173 PLAYWRIGHT_MODULE_DIR=/path/with/node_modules/ \
  node scripts/browser/smoke-app.mjs      # every route, search/Back, reader to the last page
SMOKE_BASE=http://localhost:5173 PLAYWRIGHT_MODULE_DIR=/path/with/node_modules/ \
  node scripts/browser/smoke-reader.mjs   # phone viewport: scrubber, panel rules, resume, vertical
```

`SMOKE_BASE` may include a base path (e.g. `http://localhost:4173/Zine`)
to run them against a production build served under a sub-path.

## Local shelf (no server)

**Library → On device → Import** accepts `.cbz`/`.zip` chapter archives,
`.pdf` files (each page rendered to an image via PDF.js, loaded on demand),
or loose image files. Imports are stored in the browser's IndexedDB and read
with the full reader (autoplay included) with zero network involved — they
survive reloads and work when MangaDex and the relays are unreachable.
Each archive becomes one chapter (pages in natural filename order); more
chapters can be added from the series page, which also has
"Remove from device". Local series never touch any server, and the app
never bundles or distributes manga content itself — you import your own
files.

Offline caveat: reading needs no network once the app is open, but there
is no service worker, so *loading* the app while offline only works as
long as the browser still has it in its HTTP cache.

## Online sources

Zine is multi-source: search queries **MangaDex** and **Comick** in
parallel and shows each source's results as it answers (duplicates
collapsed by title, Comick results marked with a `ck` stamp). Detail
pages, chapter lists, and pages route to whichever source owns the book.
The homepage rails fall back MangaDex → Comick → Jikan (MyAnimeList data,
discovery only; its cards hand off to a title search).

Status as observed on 2026-11-16: Comick's API hosts did not answer
(`api.comick.fun` no longer resolves, `api.comick.io` timed out). Search
still returns MangaDex results immediately and stays usable while the
other source is pending.

## MangaDex API and CORS (hosted deployments)

MangaDex's API does not send CORS headers for third-party origins, so a
hosted Zine (GitHub Pages, Cloudflare, …) can't call it directly from the
browser. There are two ways around that:

1. **Personal proxy (reliable)** — any server that forwards requests to
   `api.mangadex.org` with a descriptive `User-Agent` and returns them with
   CORS headers. Ready-made one-file versions ship in `cors-proxy/`
   (Cloudflare Workers, Deno Deploy, Vercel, Netlify — all free tiers).
   Deploy one and paste its URL into **Settings → Content → API proxy**.
   With a proxy set, all MangaDex API traffic goes through it and the
   public relays are not used.
2. **Public relay fallback (best effort)** — with no proxy set, a failed
   direct call falls back to a chain of public relays (r.jina.ai →
   allorigins `/get` → allorigins `/raw` → codetabs): the first fires
   immediately, the others join if it has not answered within 2.5s, the
   winner is remembered for the session, and failing relays are benched
   with per-source cooldowns. A genuine MangaDex error (like a 404) passing
   through a relay is surfaced as-is, never retried across relays.

   **This path could not load anything when last checked (2026-11-16):**
   MangaDex served the primary relay its "Browser verification" page
   instead of JSON, and the other relays failed or timed out. When that
   happens the app says so and points at the proxy setting. Settings →
   Connection → *Connection doctor* shows what your own device can reach.

Images (covers, chapter pages) load as plain `<img>` elements, which
browsers don't subject to CORS.

## MangaDex API notes

- Page URLs from `/at-home/server` expire (~15 min): the reader refetches
  on staleness or image error, and shows a retry if a page still fails.
- MangaDex@Home asks clients to report each image load to
  `api.mangadex.network/report`. Zine does not: a cross-origin preflight to
  that endpoint went unanswered when tested (2026-11-16), and `<img>` loads
  cannot see the byte count or cache header the report requires.
- Covers must be rendered with `referrerPolicy="no-referrer"` —
  `uploads.mangadex.org` rejects foreign referrers.
- The API allows ~5 req/s per IP; the full-feed fetch paces itself and 429s
  surface as typed `MangaDexError`s with a "Try again".
