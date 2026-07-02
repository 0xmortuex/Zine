import { useCallback, useEffect, useRef, useState } from 'react'
import { getChaptersAll } from '../api'
import { useSettings } from '../store/useSettings'
import { getCachedChapters, setCachedChapters } from '../store/chapterCache'

/**
 * Load the complete chapter feed for a manga (all pages), with live
 * progress and an in-memory cache shared with the reader.
 */
export function useChapters(mangaId) {
  const languages = useSettings((s) => s.languages)
  const contentRatings = useSettings((s) => s.contentRatings)
  const [chapters, setChapters] = useState(() => getCachedChapters(mangaId, languages))
  const [loading, setLoading] = useState(!chapters)
  const [progress, setProgress] = useState({ loaded: 0, total: 0 })
  const [error, setError] = useState(null)
  const generation = useRef(0)

  const load = useCallback(async () => {
    if (!mangaId) return
    const gen = ++generation.current
    const cached = getCachedChapters(mangaId, languages)
    if (cached) {
      setChapters(cached)
      setLoading(false)
      setError(null)
      return
    }
    setChapters(null)
    setLoading(true)
    setError(null)
    setProgress({ loaded: 0, total: 0 })
    try {
      const items = await getChaptersAll(mangaId, { languages, contentRatings }, (loaded, total) => {
        if (gen === generation.current) setProgress({ loaded, total })
      })
      if (gen !== generation.current) return
      setCachedChapters(mangaId, languages, items)
      setChapters(items)
    } catch (err) {
      if (gen === generation.current) setError(err)
    } finally {
      if (gen === generation.current) setLoading(false)
    }
  }, [mangaId, languages, contentRatings])

  useEffect(() => {
    load()
  }, [load])

  return { chapters, loading, progress, error, reload: load }
}
