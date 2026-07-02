# Zine

A personal manga reader built with React, Vite, and Tailwind CSS, backed by the
official public [MangaDex REST API](https://api.mangadex.org/docs/).

## Getting started

```sh
npm install
npm run dev
```

## Project layout

```
src/
  api/mangadex.js   # MangaDex API client (search, chapters, page URLs)
  App.jsx           # App shell — currently a search UI over the API client
  main.jsx          # React entry point
  index.css         # Tailwind entry
```

## API client

`src/api/mangadex.js` wraps the four endpoints the reader needs:

| Function | Endpoint | Purpose |
| --- | --- | --- |
| `searchManga(title, { limit, offset })` | `GET /manga` | Title search with covers resolved |
| `getManga(id)` | `GET /manga/{id}` | Single manga details |
| `getChapters(id, { languages, limit, offset })` | `GET /manga/{id}/feed` | Chapter list, volume/chapter ascending |
| `getChapterPages(chapterId, { dataSaver })` | `GET /at-home/server/{id}` | Ordered page image URLs |

All functions return normalized plain objects; failures throw `MangaDexError`
with `status` and `detail`.

### Things worth knowing

- **Page URLs expire.** `getChapterPages` resolves URLs through MangaDex's
  at-home network; the base URL is valid for ~15 minutes, so fetch right
  before reading rather than caching.
- **Covers need `referrerPolicy="no-referrer"`.** `uploads.mangadex.org`
  rejects hotlinked images that carry a foreign `Referer` header.
- **Rate limits.** The API allows roughly 5 requests/second per IP; 429
  responses surface as a `MangaDexError` with `status: 429`.
- **External chapters.** Some chapters are hosted off-site (`externalUrl`
  set, `pages === 0`) and can't be read in-app.
