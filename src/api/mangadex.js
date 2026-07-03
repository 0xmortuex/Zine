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

/**
 * MangaDex's API doesn't send CORS headers for third-party origins, so
 * direct browser calls from a hosted site (e.g. GitHub Pages) fail as
 * opaque network errors. Escape hatches, in priority order:
 *   1. A user-configured proxy (Settings → Content → API proxy), for
 *      anyone who wants a private relay (see cors-proxy/worker.js).
 *   2. Zero-setup fallback: public CORS relays. Every attempt carries a
 *      hard timeout (public relays hang more often than they error), the
 *      first discovery RACES all relays in parallel and the first valid
 *      answer wins, the winner is remembered for the session, and once a
 *      direct call has CORS-failed we go relay-first instead of re-paying
 *      the failed direct attempt on every request.
 */
const DIRECT_TIMEOUT_MS = 8_000
const RELAY_TIMEOUT_MS = 15_000

const PUBLIC_RELAYS = [
  {
    name: 'allorigins',
    wrap: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'codetabs',
    wrap: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  },
  {
    name: 'corsproxy',
    wrap: (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  },
  {
    // allorigins' JSON envelope endpoint — different code path on their
    // side, so it often works when /raw is struggling.
    name: 'allorigins-json',
    wrap: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    unwrap: (envelope) => ({
      status: envelope?.status?.http_code ?? 200,
      body: JSON.parse(envelope?.contents ?? ''),
    }),
  },
]

const RELAYS_DOWN_MESSAGE =
  'Could not reach MangaDex: the direct connection is blocked (CORS or network) and no public ' +
  'relay responded. If this keeps happening, your network may be blocking MangaDex — try a ' +
  'VPN, or set a personal API proxy in Settings → Content.'

let corsBlocked = false // a direct call failed at the network level this session
let workingRelay = null // index of the relay that won the race, if any

function userProxyBase() {
  try {
    const raw = localStorage.getItem('zine-settings')
    const proxy = raw ? JSON.parse(raw)?.state?.apiProxy : ''
    return proxy ? proxy.trim().replace(/\/+$/, '') : null
  } catch {
    return null
  }
}

export class MangaDexError extends Error {
  constructor(message, { status, detail, network = false } = {}) {
    super(message)
    this.name = 'MangaDexError'
    this.status = status
    this.detail = detail
    this.network = network
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

/** Timeout signal, optionally combined with an external abort (relay race). */
function makeSignal(timeoutMs, external) {
  const timeout = AbortSignal.timeout?.(timeoutMs)
  if (timeout && external && AbortSignal.any) return AbortSignal.any([timeout, external])
  return external ?? timeout
}

/** Fetch + JSON parse. Network-level failures (incl. timeouts) throw with network: true. */
async function rawFetch(url, timeoutMs, externalSignal) {
  let res
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: makeSignal(timeoutMs, externalSignal),
    })
  } catch (err) {
    throw new MangaDexError('Network error reaching MangaDex', {
      detail: err.message,
      network: true,
    })
  }
  const body = await res.json().catch(() => null)
  return { res, body }
}

/** Turn a (status, parsed body) pair into a result or a typed error. */
function validate(status, body, statusText = '') {
  if (status === 429) {
    throw new MangaDexError('Rate limited by MangaDex — slow down and retry shortly', {
      status: 429,
    })
  }
  if (!body || status >= 400 || body.result === 'error') {
    const detail = body?.errors?.[0]?.detail ?? (body ? statusText : 'Invalid JSON response')
    throw new MangaDexError(`MangaDex request failed: ${detail}`, { status, detail })
  }
  return body
}

async function directFetch(url, timeoutMs = DIRECT_TIMEOUT_MS) {
  const { res, body } = await rawFetch(url, timeoutMs)
  return validate(res.status, body, res.statusText)
}

/** Genuine upstream API errors shouldn't be retried on another relay. */
const isUpstreamApiError = (err) =>
  err instanceof MangaDexError && err.status >= 400 && err.status < 500 && err.status !== 429

async function relayFetch(relay, directUrl, externalSignal) {
  const { res, body } = await rawFetch(relay.wrap(directUrl), RELAY_TIMEOUT_MS, externalSignal)
  let status = res.status
  let payload = body
  if (relay.unwrap) {
    let inner
    try {
      inner = relay.unwrap(body)
    } catch {
      throw new MangaDexError(`Relay ${relay.name} returned an invalid envelope`, { network: true })
    }
    status = inner.status
    payload = inner.body
  }
  try {
    return validate(status, payload, res.statusText)
  } catch (err) {
    // A 429 here is usually the relay's own rate limit, not MangaDex's —
    // treat it as a relay failure so the race can move on.
    if (err.status === 429) {
      throw new MangaDexError(`Relay ${relay.name} rate-limited`, { network: true })
    }
    throw err
  }
}

/**
 * Race every public relay; first valid answer wins and is remembered.
 * An authoritative MangaDex error (4xx through a relay) rejects
 * immediately — the other relays would only repeat it.
 */
function raceRelays(directUrl) {
  const controllers = PUBLIC_RELAYS.map(() => new AbortController())
  return new Promise((resolve, reject) => {
    let pending = PUBLIC_RELAYS.length
    let lastError = null
    let settled = false

    PUBLIC_RELAYS.forEach((relay, index) => {
      relayFetch(relay, directUrl, controllers[index].signal).then(
        (body) => {
          if (settled) return
          settled = true
          workingRelay = index
          controllers.forEach((c, j) => j !== index && c.abort())
          resolve(body)
        },
        (err) => {
          if (settled) return
          if (isUpstreamApiError(err)) {
            settled = true
            controllers.forEach((c, j) => j !== index && c.abort())
            reject(err)
            return
          }
          lastError = err
          if (--pending === 0) {
            settled = true
            reject(new MangaDexError(RELAYS_DOWN_MESSAGE, { network: true, detail: lastError?.detail }))
          }
        },
      )
    })
  })
}

async function request(path, params) {
  const pathAndQuery = `${path}${buildQuery(params)}`
  const proxy = userProxyBase()
  if (proxy) {
    const { res, body } = await rawFetch(`${proxy}${pathAndQuery}`, RELAY_TIMEOUT_MS)
    return validate(res.status, body, res.statusText)
  }

  const directUrl = `${API_BASE}${pathAndQuery}`
  const isBrowser = typeof window !== 'undefined'

  if (!isBrowser || !corsBlocked) {
    try {
      return await directFetch(directUrl)
    } catch (err) {
      // A network-level failure on a direct browser call is almost always
      // the CORS block — fall through to the public relays. Anything else
      // (real API errors, rate limits, node) propagates.
      if (!isBrowser || !(err instanceof MangaDexError) || !err.network) throw err
      corsBlocked = true
    }
  }

  // Steady state: reuse the relay that won the race; on failure, re-race.
  if (workingRelay != null) {
    try {
      return await relayFetch(PUBLIC_RELAYS[workingRelay], directUrl)
    } catch (err) {
      if (isUpstreamApiError(err)) throw err
      workingRelay = null
    }
  }

  return raceRelays(directUrl)
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
