/**
 * API entry point and source router. Components import from here only.
 *
 * Online sources: MangaDex (default) and Comick (ids prefixed "ck:") — an
 * independent API, so when one source is slow, blocked, or rate-limited,
 * the other still serves. Search queries every online source in parallel
 * and merges whatever answers; detail/chapter/page requests dispatch to
 * the source that owns the id. The local shelf (ids prefixed "local:")
 * is served from IndexedDB. VITE_USE_FIXTURES=1 swaps the online layer
 * for offline fixtures.
 */
import * as real from './mangadex'
import * as fixtures from './fixtures'
import {
  isComickId,
  searchComick,
  getComickManga,
  getComickChaptersAll,
  getComickChapter,
  getComickChapterPages,
  getComickTop,
} from './comick'
import { getJikanPopular, getJikanTrending } from './jikan'
import { streamSearch } from './searchStream'
import {
  isLocalId,
  getLocalManga,
  findLocalChapter,
  getLocalChapterPageBlobs,
  normalizeLocalManga,
  normalizeLocalChapter,
} from '../lib/localLibrary'

const api = import.meta.env.VITE_USE_FIXTURES ? fixtures : real

export const USING_FIXTURES = Boolean(import.meta.env.VITE_USE_FIXTURES)

export { MangaDexError } from './mangadex'
export const { coverUrl } = api

const SEARCH_SOURCE_TIMEOUT_MS = 12_000

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('source timed out')), ms)),
  ])

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Streaming search: each source's results are pushed via onBatch the
 * moment that source answers — never waiting for the slowest or a dead
 * source. Duplicates collapse by title, first arrival wins. Resolves
 * { partial } once all sources settle; throws only if every source failed.
 */
export async function searchMangaStream(title, opts = {}, onBatch) {
  if (USING_FIXTURES) {
    const result = await api.searchManga(title, opts)
    onBatch(result.items, { total: result.total, source: 'fixtures' })
    return { partial: false }
  }
  return streamSearch(
    [
      () =>
        withTimeout(real.searchManga(title, opts), SEARCH_SOURCE_TIMEOUT_MS).then((r) => ({
          ...r,
          source: 'mangadex',
        })),
      // Comick starts 400ms behind so the two discovery relay-races don't
      // slam the shared relay pool at the exact same instant.
      () =>
        withTimeout(
          delay(400).then(() => searchComick(title, { limit: opts.limit })),
          SEARCH_SOURCE_TIMEOUT_MS,
        ).then((r) => ({ ...r, source: 'comick' })),
    ],
    onBatch,
  )
}

/** Offset pagination for "load more" — MangaDex only (Comick is single-shot). */
export function searchMangaMore(title, opts = {}) {
  if (USING_FIXTURES) return api.searchManga(title, opts)
  return real.searchManga(title, opts)
}

/** Aggregating wrapper for non-streaming callers. */
export async function searchManga(title, opts = {}) {
  const items = []
  let total = 0
  const { partial } = await searchMangaStream(title, opts, (batch, meta) => {
    items.push(...batch)
    total += meta.total ?? batch.length
  })
  return { items, total, limit: opts.limit ?? items.length, offset: opts.offset ?? 0, partial }
}

/**
 * Lightweight type-ahead suggestions. Single-source (MangaDex has the best
 * title search) and small so it stays cheap on the relay budget; repeats
 * hit the request cache.
 */
export async function suggestManga(title, { contentRatings, availableLanguages } = {}) {
  if (USING_FIXTURES) return (await api.searchManga(title, { limit: 5 })).items
  const result = await real.searchManga(title, { limit: 5, contentRatings, availableLanguages })
  return result.items
}

/**
 * Homepage rails. MangaDex first (its popularity data is richer); Comick's
 * /top lists as fallback when MangaDex is unreachable. Resolves [] instead
 * of throwing — the homepage hides empty rails rather than erroring.
 */
async function firstNonEmpty(attempts) {
  for (const attempt of attempts) {
    try {
      const items = await attempt()
      if (items?.length > 0) return items
    } catch {
      /* try the next tier */
    }
  }
  return []
}

export function getPopularManga(opts) {
  if (USING_FIXTURES) return api.getPopularManga(opts)
  const limit = opts?.limit ?? 12
  return firstNonEmpty([
    () => real.getPopularManga(opts),
    async () => (await getComickTop()).popular.slice(0, limit),
    () => getJikanPopular(limit),
  ])
}

export function getTrendingManga(opts) {
  if (USING_FIXTURES) return api.getTrendingManga(opts)
  const limit = opts?.limit ?? 12
  return firstNonEmpty([
    () => real.getTrendingManga(opts),
    async () => (await getComickTop()).trending.slice(0, limit),
    () => getJikanTrending(limit),
  ])
}

export async function getManga(mangaId) {
  if (isLocalId(mangaId)) {
    const entry = await getLocalManga(mangaId)
    if (!entry) throw new real.MangaDexError('Local manga not found on this device', { status: 404 })
    return normalizeLocalManga(entry)
  }
  if (isComickId(mangaId)) return getComickManga(mangaId)
  return api.getManga(mangaId)
}

export async function getChapters(mangaId, opts) {
  if (isLocalId(mangaId) || isComickId(mangaId)) {
    const items = await getChaptersAll(mangaId, opts)
    return { items, total: items.length, limit: items.length, offset: 0 }
  }
  return api.getChapters(mangaId, opts)
}

export async function getChaptersAll(mangaId, opts, onProgress) {
  if (isLocalId(mangaId)) {
    const entry = await getLocalManga(mangaId)
    const items = (entry?.chapters ?? []).map(normalizeLocalChapter)
    onProgress?.(items.length, items.length)
    return items
  }
  if (isComickId(mangaId)) return getComickChaptersAll(mangaId, opts, onProgress)
  return api.getChaptersAll(mangaId, opts, onProgress)
}

export async function getChapter(chapterId) {
  if (isLocalId(chapterId)) {
    const found = await findLocalChapter(chapterId)
    if (!found) throw new real.MangaDexError('Local chapter not found on this device', { status: 404 })
    return { ...normalizeLocalChapter(found.chapter), mangaId: found.manga.id }
  }
  if (isComickId(chapterId)) return getComickChapter(chapterId)
  return api.getChapter(chapterId)
}

export async function getChapterPages(chapterId, opts) {
  if (isLocalId(chapterId)) {
    const blobs = await getLocalChapterPageBlobs(chapterId)
    return blobs.map((blob) => URL.createObjectURL(blob))
  }
  if (isComickId(chapterId)) return getComickChapterPages(chapterId)
  return api.getChapterPages(chapterId, opts)
}
