/**
 * Thin client for the official public MangaDex REST API.
 * Docs: https://api.mangadex.org/docs/
 *
 * Endpoints used:
 *   GET /manga                    — search manga by title
 *   GET /manga/{id}               — fetch a single manga
 *   GET /manga/{id}/feed          — list chapters for a manga
 *   GET /at-home/server/{id}      — resolve page image URLs for a chapter
 *
 * MangaDex rate-limits by IP (~5 req/s global). Keep requests deliberate;
 * don't fetch page URLs until the user actually opens a chapter.
 */

const API_BASE = 'https://api.mangadex.org'
const COVER_BASE = 'https://uploads.mangadex.org/covers'

export class MangaDexError extends Error {
  constructor(message, { status, detail } = {}) {
    super(message)
    this.name = 'MangaDexError'
    this.status = status
    this.detail = detail
  }
}

/**
 * Build a query string the way the MangaDex API expects it:
 * arrays become repeated `key[]=value` pairs and nested objects
 * (e.g. order) become `key[sub]=value`.
 */
function buildQuery(params = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const item of value) query.append(`${key}[]`, item)
    } else if (typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value)) {
        query.append(`${key}[${subKey}]`, subValue)
      }
    } else {
      query.append(key, value)
    }
  }
  const s = query.toString()
  return s ? `?${s}` : ''
}

async function request(path, params) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}${buildQuery(params)}`, {
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    throw new MangaDexError('Network error reaching MangaDex', { detail: err.message })
  }

  if (res.status === 429) {
    throw new MangaDexError('Rate limited by MangaDex — slow down and retry shortly', {
      status: 429,
    })
  }

  const body = await res.json().catch(() => null)
  if (!res.ok || body?.result === 'error') {
    const detail = body?.errors?.[0]?.detail ?? res.statusText
    throw new MangaDexError(`MangaDex request failed: ${detail}`, {
      status: res.status,
      detail,
    })
  }
  return body
}

/** Pick a display string from MangaDex's localized-string maps ({ en: "...", ja: "..." }). */
function pickLocalized(localized, preferred = 'en') {
  if (!localized) return ''
  return localized[preferred] ?? Object.values(localized)[0] ?? ''
}

/**
 * Flatten a raw manga entity into the shape the UI consumes.
 * Cover art rides along in `relationships` when requested via includes[].
 */
function normalizeManga(entity) {
  const { id, attributes, relationships = [] } = entity
  const coverRel = relationships.find((rel) => rel.type === 'cover_art')
  const coverFileName = coverRel?.attributes?.fileName ?? null
  const altTitles = (attributes.altTitles ?? []).map((t) => pickLocalized(t))

  return {
    id,
    title: pickLocalized(attributes.title),
    altTitles,
    description: pickLocalized(attributes.description),
    status: attributes.status,
    year: attributes.year,
    contentRating: attributes.contentRating,
    tags: (attributes.tags ?? []).map((tag) => pickLocalized(tag.attributes?.name)),
    availableLanguages: attributes.availableTranslatedLanguages ?? [],
    coverUrl: coverFileName ? coverUrl(id, coverFileName) : null,
    coverThumbUrl: coverFileName ? coverUrl(id, coverFileName, 256) : null,
  }
}

function normalizeChapter(entity) {
  const { id, attributes, relationships = [] } = entity
  const group = relationships.find((rel) => rel.type === 'scanlation_group')
  return {
    id,
    volume: attributes.volume,
    chapter: attributes.chapter,
    title: attributes.title ?? '',
    translatedLanguage: attributes.translatedLanguage,
    pages: attributes.pages,
    publishAt: attributes.publishAt,
    // Chapters hosted off-site (externalUrl set, pages === 0) can't be read in-app.
    externalUrl: attributes.externalUrl ?? null,
    scanlationGroup: group?.attributes?.name ?? null,
  }
}

/**
 * Build a cover image URL.
 * `size` of 256 or 512 selects MangaDex's pre-generated thumbnails.
 * Note: uploads.mangadex.org rejects hotlinked requests that carry a
 * foreign Referer — render covers with referrerPolicy="no-referrer".
 */
export function coverUrl(mangaId, fileName, size) {
  const suffix = size ? `.${size}.jpg` : ''
  return `${COVER_BASE}/${mangaId}/${fileName}${suffix}`
}

const DEFAULT_CONTENT_RATINGS = ['safe', 'suggestive']

/**
 * Search manga by title.
 * Returns { items, total, limit, offset } where items are normalized manga.
 */
export async function searchManga(
  title,
  { limit = 20, offset = 0, contentRatings = DEFAULT_CONTENT_RATINGS } = {},
) {
  const body = await request('/manga', {
    title,
    limit,
    offset,
    includes: ['cover_art'],
    contentRating: contentRatings,
    order: { relevance: 'desc' },
  })
  return {
    items: body.data.map(normalizeManga),
    total: body.total,
    limit: body.limit,
    offset: body.offset,
  }
}

/** Fetch a single manga by id (with cover art resolved). */
export async function getManga(mangaId) {
  const body = await request(`/manga/${mangaId}`, { includes: ['cover_art'] })
  return normalizeManga(body.data)
}

/**
 * List readable chapters for a manga, ordered volume → chapter ascending.
 * Returns { items, total, limit, offset } where items are normalized chapters.
 */
export async function getChapters(
  mangaId,
  { languages = ['en'], limit = 100, offset = 0, contentRatings = DEFAULT_CONTENT_RATINGS } = {},
) {
  const body = await request(`/manga/${mangaId}/feed`, {
    translatedLanguage: languages,
    limit,
    offset,
    includes: ['scanlation_group'],
    order: { volume: 'asc', chapter: 'asc' },
    contentRating: contentRatings,
  })
  return {
    items: body.data.map(normalizeChapter),
    total: body.total,
    limit: body.limit,
    offset: body.offset,
  }
}

/** Max chapters fetched by getChaptersAll — a runaway/pathological-feed guard. */
const FEED_PAGE_SIZE = 500
const FEED_MAX_PAGES = 20

/**
 * Fetch the complete chapter feed for a manga, paging through the API in
 * 500-item batches with a small delay between requests (MangaDex allows
 * ~5 req/s per IP). `onProgress(loaded, total)` fires after each batch.
 */
export async function getChaptersAll(mangaId, { languages, contentRatings } = {}, onProgress) {
  const items = []
  let offset = 0
  let total = Infinity
  for (let page = 0; page < FEED_MAX_PAGES && offset < total; page++) {
    if (page > 0) await new Promise((resolve) => setTimeout(resolve, 250))
    const batch = await getChapters(mangaId, {
      languages,
      contentRatings,
      limit: FEED_PAGE_SIZE,
      offset,
    })
    items.push(...batch.items)
    total = batch.total
    offset += FEED_PAGE_SIZE
    onProgress?.(Math.min(items.length, total), total)
  }
  return items
}

/** Fetch a single chapter (deep-link fallback), with its manga id resolved. */
export async function getChapter(chapterId) {
  const body = await request(`/chapter/${chapterId}`, { includes: ['scanlation_group', 'manga'] })
  const chapter = normalizeChapter(body.data)
  const mangaRel = body.data.relationships?.find((rel) => rel.type === 'manga')
  return { ...chapter, mangaId: mangaRel?.id ?? null }
}

/**
 * Resolve the full page image URLs for a chapter via the at-home network.
 * The returned baseUrl is valid for ~15 minutes, so call this right before
 * reading — don't cache the URLs long-term.
 *
 * @param {string} chapterId
 * @param {{ dataSaver?: boolean }} opts — dataSaver serves compressed pages.
 * @returns {Promise<string[]>} ordered page image URLs
 */
export async function getChapterPages(chapterId, { dataSaver = false } = {}) {
  const body = await request(`/at-home/server/${chapterId}`)
  const { baseUrl, chapter } = body
  const quality = dataSaver ? 'data-saver' : 'data'
  const files = dataSaver ? chapter.dataSaver : chapter.data
  return files.map((file) => `${baseUrl}/${quality}/${chapter.hash}/${file}`)
}
