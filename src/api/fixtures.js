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

const uri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`

/* Deterministic pseudo-random per seed so covers are stable across reloads. */
const rand = (seed) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Generated manga-style cover: gradient sky, sun/moon, mountain silhouettes,
 * halftone corner, speed-line band, masthead title. Distinct palette and
 * composition per series index.
 */
function fixtureCover(index, title) {
  const hue = (index * 47 + 20) % 360
  const hue2 = (hue + 40) % 360
  const night = index % 3 === 0
  const skyTop = night ? `oklch(0.25 0.09 ${hue})` : `oklch(0.85 0.08 ${hue})`
  const skyBottom = night ? `oklch(0.45 0.12 ${hue2})` : `oklch(0.68 0.14 ${hue2})`
  const ink = night ? 'oklch(0.16 0.04 280)' : `oklch(0.28 0.09 ${hue})`
  const orb = night ? 'oklch(0.95 0.02 90)' : `oklch(0.88 0.16 ${(hue + 80) % 360})`
  const orbX = 90 + rand(index) * 220
  const orbY = 110 + rand(index + 1) * 120
  const m1 = 300 - rand(index + 2) * 90
  const m2 = 340 - rand(index + 3) * 70
  const dots = Array.from({ length: 24 }, (_, d) => {
    const col = d % 6
    const row = Math.floor(d / 6)
    return `<circle cx="${330 + col * 12}" cy="${20 + row * 12}" r="${3.4 - row * 0.55}" fill="${ink}" opacity="0.5"/>`
  }).join('')
  const speedLines = Array.from({ length: 9 }, (_, s) => {
    const y = 380 + s * 12 + rand(index + s) * 6
    return `<line x1="0" y1="${y}" x2="${140 + rand(index + s + 9) * 160}" y2="${y}" stroke="${ink}" stroke-width="${1 + (s % 3)}" opacity="${0.25 + (s % 3) * 0.12}"/>`
  }).join('')
  const words = title.split(' ')
  const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ')
  const line2 = words.slice(Math.ceil(words.length / 2)).join(' ')

  return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBottom}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#sky)"/>
  <circle cx="${orbX}" cy="${orbY}" r="58" fill="${orb}"/>
  <circle cx="${orbX}" cy="${orbY}" r="58" fill="none" stroke="${ink}" stroke-width="2" opacity="0.25"/>
  ${dots}
  <polygon points="0,${m1} 150,${m1 - 120} 290,${m1 + 40} 0,${m1 + 200}" fill="${ink}" opacity="0.75"/>
  <polygon points="400,${m2} 250,${m2 - 90} 120,${m2 + 60} 400,${m2 + 180}" fill="${ink}" opacity="0.9"/>
  ${speedLines}
  <rect x="0" y="452" width="400" height="148" fill="oklch(0.97 0.01 ${hue})"/>
  <rect x="0" y="452" width="400" height="6" fill="${ink}"/>
  <text x="22" y="512" font-family="Georgia, serif" font-weight="bold" font-size="34" fill="${ink}">${line1}</text>
  ${line2 ? `<text x="22" y="552" font-family="Georgia, serif" font-weight="bold" font-size="34" fill="${ink}">${line2}</text>` : ''}
  <text x="22" y="582" font-family="system-ui" font-size="13" letter-spacing="4" fill="${ink}" opacity="0.6">ZINE FIXTURE PRESS</text>
  <rect x="352" y="470" width="34" height="112" fill="${ink}"/>
  <text x="369" y="480" font-family="system-ui" font-size="12" fill="white" writing-mode="tb" letter-spacing="3">VOL. ${(index % 4) + 1}</text>
</svg>`)
}

/**
 * Generated manga page: paper background, panel grid with varied layout,
 * screentone dots, speech bubble, action burst, page number.
 */
function fixturePage(seed, n) {
  const layout = (seed + n) % 3
  const tone = Array.from({ length: 60 }, (_, d) => {
    const col = d % 10
    const row = Math.floor(d / 10)
    return `<circle cx="${76 + col * 13}" cy="${86 + row * 13}" r="2.2" fill="black" opacity="0.35"/>`
  }).join('')
  const panels =
    layout === 0
      ? `<rect x="60" y="70" width="680" height="380" class="p"/>
         <rect x="60" y="480" width="330" height="300" class="p"/>
         <rect x="420" y="480" width="320" height="300" class="p"/>
         <rect x="60" y="810" width="680" height="320" class="p"/>`
      : layout === 1
        ? `<rect x="60" y="70" width="330" height="500" class="p"/>
           <rect x="420" y="70" width="320" height="230" class="p"/>
           <rect x="420" y="330" width="320" height="240" class="p"/>
           <polygon points="60,600 740,640 740,1130 60,1130" class="p"/>`
        : `<rect x="60" y="70" width="680" height="240" class="p"/>
           <polygon points="60,340 420,340 340,700 60,700" class="p"/>
           <polygon points="450,340 740,340 740,700 370,700" class="p"/>
           <rect x="60" y="730" width="680" height="400" class="p"/>`
  const burst = Array.from({ length: 12 }, (_, s) => {
    const a = (s / 12) * Math.PI * 2
    const r1 = 40
    const r2 = 78 + (s % 2) * 22
    const cx = 560
    const cy = 940
    return `<line x1="${cx + Math.cos(a) * r1}" y1="${cy + Math.sin(a) * r1}" x2="${cx + Math.cos(a) * r2}" y2="${cy + Math.sin(a) * r2}" stroke="black" stroke-width="3"/>`
  }).join('')

  return uri(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
  <style>.p{fill:white;stroke:black;stroke-width:4}</style>
  <rect width="800" height="1200" fill="oklch(0.97 0.005 90)"/>
  ${panels}
  ${tone}
  <ellipse cx="240" cy="180" rx="120" ry="62" fill="white" stroke="black" stroke-width="3"/>
  <polygon points="230,236 260,232 218,278" fill="white" stroke="black" stroke-width="3"/>
  <text x="240" y="176" text-anchor="middle" font-family="system-ui" font-weight="bold" font-size="26">PAGE ${n}!</text>
  ${burst}
  <text x="560" y="950" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="40" transform="rotate(-8 560 940)">FIX!</text>
  <text x="400" y="1180" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="black">— ${n} —</text>
</svg>`)
}

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
