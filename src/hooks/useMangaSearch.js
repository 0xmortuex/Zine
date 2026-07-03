import { useCallback, useRef, useState } from 'react'
import { searchMangaStream, searchMangaMore } from '../api'
import { titleKey } from '../api/searchStream'
import { useSettings } from '../store/useSettings'

const PAGE_SIZE = 20

/**
 * Streaming search state: results from each source appear the moment that
 * source answers instead of waiting for the slowest. `loading` stays true
 * while slower sources are still being awaited, so the UI can show partial
 * results plus a "still searching" hint. Stale responses (from an older
 * query) are dropped via a request counter. Load-more pages through
 * MangaDex offsets, deduped against everything already shown.
 */
export function useMangaSearch() {
  const contentRatings = useSettings((s) => s.contentRatings)
  const languages = useSettings((s) => s.languages)
  const readableOnly = useSettings((s) => s.readableOnly)
  const availableLanguages = readableOnly ? languages : undefined
  const [query, setQuery] = useState('')
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const requestId = useRef(0)
  const seenTitles = useRef(new Set())
  const mangadexPaging = useRef({ count: 0, total: 0 })

  const search = useCallback(
    async (title) => {
      const q = title.trim()
      if (!q) return
      const id = ++requestId.current
      setQuery(q)
      setLoading(true)
      setError(null)
      setItems(null)
      seenTitles.current = new Set()
      mangadexPaging.current = { count: 0, total: 0 }
      try {
        await searchMangaStream(
          q,
          { limit: PAGE_SIZE, contentRatings, availableLanguages },
          (batch, meta) => {
            if (id !== requestId.current) return
            for (const manga of batch) seenTitles.current.add(titleKey(manga.title))
            if (meta.source === 'mangadex' || meta.source === 'fixtures') {
              mangadexPaging.current = { count: batch.length, total: meta.total ?? batch.length }
            }
            setItems((prev) => [...(prev ?? []), ...batch])
          },
        )
        if (id === requestId.current) setItems((prev) => prev ?? [])
      } catch (err) {
        if (id !== requestId.current) return
        setError(err)
        setItems(null)
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [contentRatings, availableLanguages],
  )

  const loadMore = useCallback(async () => {
    const paging = mangadexPaging.current
    if (!query || loadingMore || paging.count >= paging.total) return
    const id = requestId.current
    setLoadingMore(true)
    try {
      const result = await searchMangaMore(query, {
        limit: PAGE_SIZE,
        offset: paging.count,
        contentRatings,
        availableLanguages,
      })
      if (id !== requestId.current) return
      paging.count += result.items.length
      paging.total = result.total
      const fresh = result.items.filter((manga) => {
        const key = titleKey(manga.title)
        if (seenTitles.current.has(key)) return false
        seenTitles.current.add(key)
        return true
      })
      setItems((prev) => [...(prev ?? []), ...fresh])
    } catch (err) {
      if (id === requestId.current) setError(err)
    } finally {
      if (id === requestId.current) setLoadingMore(false)
    }
  }, [query, loadingMore, contentRatings, availableLanguages])

  const hasMore = Boolean(
    items && mangadexPaging.current.count < mangadexPaging.current.total,
  )

  return { query, items, loading, loadingMore, error, search, loadMore, hasMore }
}
