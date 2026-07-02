/**
 * In-memory cache of full chapter feeds, keyed by mangaId + language set.
 * Deliberately not persisted: feeds go stale and page URLs expire anyway.
 * Shared between MangaPage and ReaderPage so navigating into the reader
 * doesn't refetch the feed.
 */
const cache = new Map()

export function cacheKey(mangaId, languages) {
  return `${mangaId}|${[...languages].sort().join(',')}`
}

export function getCachedChapters(mangaId, languages) {
  return cache.get(cacheKey(mangaId, languages)) ?? null
}

export function setCachedChapters(mangaId, languages, items) {
  cache.set(cacheKey(mangaId, languages), items)
}

export function invalidateChapters(mangaId) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${mangaId}|`)) cache.delete(key)
  }
}
