/**
 * Fixture implementation of the MangaDex client surface (see ./mangadex.js).
 * Used when VITE_USE_FIXTURES is set — the sandbox this app is developed in
 * cannot reach api.mangadex.org, and fixtures make every UI state (volumes,
 * duplicate scanlations, oneshots, external chapters, errors) reproducible.
 * Covers and pages are generated SVG data URIs, so no network is touched.
 */

import { MangaDexError } from './mangadex'

export { MangaDexError }

const LATENCY_MS = 300

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/* ----------------------------------------------------------------------- */

function svgDataUri({ width, height, hue, title, subtitle }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="oklch(0.3 0.08 ${hue})"/>
  <rect x="12" y="12" width="${width - 24}" height="${height - 24}" fill="none" stroke="oklch(0.7 0.12 ${hue})" stroke-width="2"/>
  <text x="50%" y="46%" text-anchor="middle" fill="oklch(0.92 0.05 ${hue})" font-family="system-ui" font-weight="700" font-size="${Math.round(width / 9)}">${title}</text>
  <text x="50%" y="58%" text-anchor="middle" fill="oklch(0.75 0.08 ${hue})" font-family="system-ui" font-size="${Math.round(width / 16)}">${subtitle}</text>
</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const fixtureCover = (index, title) =>
  svgDataUri({ width: 400, height: 600, hue: (index * 47) % 360, title, subtitle: 'fixture' })

const fixturePage = (hue, n) =>
  svgDataUri({ width: 800, height: 1200, hue, title: `p. ${n}`, subtitle: 'fixture page' })

/* ----------------------------------------------------------------------- */

const TAG_POOL = [
  ['Action', 'Adventure', 'Fantasy'],
  ['Comedy', 'Slice of Life'],
  ['Drama', 'Psychological'],
  ['Romance', 'School Life'],
  ['Sci-Fi', 'Mecha'],
  ['Mystery', 'Thriller'],
]

const TITLES = [
  'Paper Lanterns',
  'The Cartographer of Nowhere',
  'Static Bloom',
  'Half-Moon Diner',
  'Iron Orchard',
  'Whisper Protocol',
  'The Last Typesetter',
  'Salt & Circuit',
  'Midnight Sonata Club',
  'Riso Ghosts',
  'A Field Guide to Falling',
  'Concrete Constellations',
]

const STATUSES = ['ongoing', 'completed', 'hiatus', 'cancelled']

const MANGA = TITLES.map((title, i) => ({
  id: `fixture-manga-${i + 1}`,
  title,
  altTitles: i % 3 === 0 ? [`${title} — 別名`] : [],
  description:
    `${title} is a fixture series used for offline development. ` +
    'It has a long enough description to exercise the expandable clamp on the detail page: ' +
    'chapters, volumes, duplicate scanlation groups, oneshots and external chapters are all ' +
    'represented somewhere in this dataset so every branch of the chapter list logic renders. ' +
    'The quick brown fox jumps over the lazy dog, twice, in tabular numerals.',
  status: STATUSES[i % STATUSES.length],
  year: 2008 + i,
  contentRating: i % 5 === 4 ? 'suggestive' : 'safe',
  tags: TAG_POOL[i % TAG_POOL.length],
  availableLanguages: i % 2 === 0 ? ['en', 'ja', 'fr'] : ['en'],
  coverUrl: fixtureCover(i, title),
  coverThumbUrl: fixtureCover(i, title),
}))

/* Chapters for the flagship fixture (fixture-manga-1): 4 volumes × 15
 * chapters, with duplicate-group versions sprinkled in, one external
 * chapter, and a oneshot (null chapter number). */
function buildFlagshipChapters() {
  const groups = ['Hairline Rule Scans', 'Offset Press', 'Colophon TL']
  const chapters = []
  let n = 0
  for (let vol = 1; vol <= 4; vol++) {
    for (let c = 1; c <= 15; c++) {
      n++
      chapters.push({
        id: `fixture-ch-${n}`,
        volume: String(vol),
        chapter: String(n),
        title: c === 1 ? `Volume ${vol} Opener` : `Chapter ${n}`,
        translatedLanguage: 'en',
        pages: 12 + (n % 6),
        publishAt: new Date(Date.UTC(2020, 0, 1) + n * 7 * 86400_000).toISOString(),
        externalUrl: null,
        scanlationGroup: groups[0],
      })
      // Every 7th chapter also exists from a second (later) group.
      if (n % 7 === 0) {
        chapters.push({
          id: `fixture-ch-${n}-alt`,
          volume: String(vol),
          chapter: String(n),
          title: `Chapter ${n}`,
          translatedLanguage: 'en',
          pages: 12 + (n % 6),
          publishAt: new Date(Date.UTC(2020, 0, 3) + n * 7 * 86400_000).toISOString(),
          externalUrl: null,
          scanlationGroup: groups[1 + (n % 2)],
        })
      }
    }
  }
  chapters.push({
    id: 'fixture-ch-oneshot',
    volume: null,
    chapter: null,
    title: 'Oneshot: The Print Room',
    translatedLanguage: 'en',
    pages: 20,
    publishAt: '2023-06-01T00:00:00.000Z',
    externalUrl: null,
    scanlationGroup: groups[0],
  })
  chapters.push({
    id: 'fixture-ch-external',
    volume: '4',
    chapter: '61',
    title: 'Official Release',
    translatedLanguage: 'en',
    pages: 0,
    publishAt: '2023-07-01T00:00:00.000Z',
    externalUrl: 'https://example.com/official/61',
    scanlationGroup: null,
  })
  return chapters
}

function buildSmallChapters(mangaIndex) {
  const count = 3 + (mangaIndex % 5)
  return Array.from({ length: count }, (_, i) => ({
    id: `fixture-m${mangaIndex}-ch-${i + 1}`,
    volume: null,
    chapter: String(i + 1),
    title: `Chapter ${i + 1}`,
    translatedLanguage: 'en',
    pages: 10 + i,
    publishAt: new Date(Date.UTC(2021, mangaIndex, 1 + i * 14)).toISOString(),
    externalUrl: null,
    scanlationGroup: 'Offset Press',
  }))
}

const CHAPTERS = Object.fromEntries(
  MANGA.map((manga, i) => [manga.id, i === 0 ? buildFlagshipChapters() : buildSmallChapters(i + 1)]),
)

const ALL_CHAPTERS = Object.entries(CHAPTERS).flatMap(([mangaId, list]) =>
  list.map((chapter) => ({ ...chapter, mangaId })),
)

/* ----------------------------------------------------------------------- */

export function coverUrl(mangaId, fileName) {
  const index = MANGA.findIndex((m) => m.id === mangaId)
  return fixtureCover(Math.max(index, 0), fileName ?? 'cover')
}

export async function searchManga(title, { limit = 20, offset = 0 } = {}) {
  await sleep(LATENCY_MS)
  const q = title.trim().toLowerCase()
  const matches = MANGA.filter((m) => m.title.toLowerCase().includes(q) || q === 'a' || q === '*')
  const items = matches.slice(offset, offset + limit)
  return { items, total: matches.length, limit, offset }
}

export async function getManga(mangaId) {
  await sleep(LATENCY_MS)
  const manga = MANGA.find((m) => m.id === mangaId)
  if (!manga) {
    throw new MangaDexError('MangaDex request failed: Manga not found', { status: 404 })
  }
  return manga
}

export async function getChapters(mangaId, { limit = 100, offset = 0 } = {}) {
  await sleep(LATENCY_MS)
  const all = CHAPTERS[mangaId] ?? []
  return { items: all.slice(offset, offset + limit), total: all.length, limit, offset }
}

export async function getChaptersAll(mangaId, _opts, onProgress) {
  await sleep(LATENCY_MS)
  const all = CHAPTERS[mangaId] ?? []
  onProgress?.(all.length, all.length)
  return [...all]
}

export async function getChapter(chapterId) {
  await sleep(LATENCY_MS)
  const found = ALL_CHAPTERS.find((c) => c.id === chapterId)
  if (!found) {
    throw new MangaDexError('MangaDex request failed: Chapter not found', { status: 404 })
  }
  return found
}

export async function getChapterPages(chapterId) {
  await sleep(LATENCY_MS)
  const chapter = ALL_CHAPTERS.find((c) => c.id === chapterId)
  const count = chapter?.pages || 14
  const hue = (chapterId.length * 31) % 360
  return Array.from({ length: count }, (_, i) => fixturePage(hue, i + 1))
}
