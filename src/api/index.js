/**
 * API entry point. Components import from here, never from ./mangadex or
 * ./fixtures directly, so the whole app can run against offline fixture
 * data with VITE_USE_FIXTURES=1 (the dev sandbox can't reach MangaDex).
 */
import * as real from './mangadex'
import * as fixtures from './fixtures'

const api = import.meta.env.VITE_USE_FIXTURES ? fixtures : real

export const USING_FIXTURES = Boolean(import.meta.env.VITE_USE_FIXTURES)

export const {
  searchManga,
  getManga,
  getChapters,
  getChaptersAll,
  getChapter,
  getChapterPages,
  coverUrl,
} = api

export { MangaDexError } from './mangadex'
