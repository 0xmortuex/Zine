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
} from './comick'
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

const SEARCH_SOURCE_TIMEOUT_MS = 20_000

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('source timed out')), ms)),
  ])

/**
 * Query every online source in parallel and merge whatever answers —
 * near-duplicates (same normalized title) keep the first source's entry.
 * Throws only when ALL sources fail, with the primary source's error.
 */
export async function searchManga(title, opts = {}) {
  if (USING_FIXTURES) return api.searchManga(title, opts)

  // Comick starts 400ms behind so the two discovery relay-races don't
  // slam the shared relay pool at the exact same instant.
  const comickDelayed = new Promise((resolve) => setTimeout(resolve, 400)).then(() =>
    searchComick(title, { limit: opts.limit }),
  )
  const attempts = await Promise.allSettled([
    withTimeout(real.searchManga(title, opts), SEARCH_SOURCE_TIMEOUT_MS),
    withTimeout(comickDelayed, SEARCH_SOURCE_TIMEOUT_MS),
  ])

  const [mangadex, comick] = attempts
  if (mangadex.status === 'rejected' && comick.status === 'rejected') {
    throw mangadex.reason
  }

  const seenTitles = new Set()
  const items = []
  let total = 0
  for (const attempt of attempts) {
    if (attempt.status !== 'fulfilled') continue
    total += attempt.value.total ?? attempt.value.items.length
    for (const manga of attempt.value.items) {
      const key = manga.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      if (seenTitles.has(key)) continue
      seenTitles.add(key)
      items.push(manga)
    }
  }
  return {
    items,
    total,
    limit: opts.limit ?? items.length,
    offset: opts.offset ?? 0,
    partial: attempts.some((a) => a.status === 'rejected'),
  }
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
