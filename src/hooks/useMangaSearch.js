import { useCallback, useRef, useState } from 'react'
import { searchManga } from '../api'
import { useSettings } from '../store/useSettings'

const PAGE_SIZE = 20

/**
 * Search state with load-more pagination. Stale responses (from an older
 * query) are dropped via a request counter.
 */
export function useMangaSearch() {
  const contentRatings = useSettings((s) => s.contentRatings)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const requestId = useRef(0)

  const search = useCallback(
    async (title) => {
      const q = title.trim()
      if (!q) return
      const id = ++requestId.current
      setQuery(q)
      setLoading(true)
      setError(null)
      try {
        const result = await searchManga(q, { limit: PAGE_SIZE, contentRatings })
        if (id !== requestId.current) return
        setItems(result.items)
        setTotal(result.total)
      } catch (err) {
        if (id !== requestId.current) return
        setError(err)
        setItems(null)
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [contentRatings],
  )

  const loadMore = useCallback(async () => {
    if (!query || loadingMore || !items || items.length >= total) return
    const id = requestId.current
    setLoadingMore(true)
    try {
      const result = await searchManga(query, {
        limit: PAGE_SIZE,
        offset: items.length,
        contentRatings,
      })
      if (id !== requestId.current) return
      setItems((prev) => [...prev, ...result.items])
      setTotal(result.total)
    } catch (err) {
      if (id === requestId.current) setError(err)
    } finally {
      if (id === requestId.current) setLoadingMore(false)
    }
  }, [query, items, total, loadingMore, contentRatings])

  const hasMore = Boolean(items && items.length < total)

  return { query, items, total, loading, loadingMore, error, search, loadMore, hasMore }
}
