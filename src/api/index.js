/**
 * API entry point. Components import from here, never from ./mangadex or
 * ./fixtures directly, so (a) the whole app can run against offline fixture
 * data with VITE_USE_FIXTURES=1, and (b) manga imported to the local shelf
 * (ids prefixed 'local:') are served from IndexedDB instead of the network.
 */
import * as real from './mangadex'
import * as fixtures from './fixtures'
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
export const { searchManga, coverUrl } = api

export async function getManga(mangaId) {
  if (isLocalId(mangaId)) {
    const entry = await getLocalManga(mangaId)
    if (!entry) throw new real.MangaDexError('Local manga not found on this device', { status: 404 })
    return normalizeLocalManga(entry)
  }
  return api.getManga(mangaId)
}

export async function getChapters(mangaId, opts) {
  if (isLocalId(mangaId)) {
    const items = await getChaptersAll(mangaId)
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
  return api.getChaptersAll(mangaId, opts, onProgress)
}

export async function getChapter(chapterId) {
  if (isLocalId(chapterId)) {
    const found = await findLocalChapter(chapterId)
    if (!found) throw new real.MangaDexError('Local chapter not found on this device', { status: 404 })
    return { ...normalizeLocalChapter(found.chapter), mangaId: found.manga.id }
  }
  return api.getChapter(chapterId)
}

export async function getChapterPages(chapterId, opts) {
  if (isLocalId(chapterId)) {
    const blobs = await getLocalChapterPageBlobs(chapterId)
    return blobs.map((blob) => URL.createObjectURL(blob))
  }
  return api.getChapterPages(chapterId, opts)
}
