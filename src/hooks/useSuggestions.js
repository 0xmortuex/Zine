import { useEffect, useRef, useState } from 'react'
import { suggestManga } from '../api'
import { useSettings } from '../store/useSettings'

const DEBOUNCE_MS = 350
const MIN_CHARS = 2

/**
 * Debounced type-ahead suggestions for the search box. Silent by design:
 * failures or slow sources simply mean no dropdown, never an error.
 */
export function useSuggestions(input) {
  const contentRatings = useSettings((s) => s.contentRatings)
  const languages = useSettings((s) => s.languages)
  const readableOnly = useSettings((s) => s.readableOnly)
  const [suggestions, setSuggestions] = useState([])
  const requestId = useRef(0)

  useEffect(() => {
    const q = input.trim()
    const id = ++requestId.current
    if (q.length < MIN_CHARS) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const items = await suggestManga(q, {
          contentRatings,
          availableLanguages: readableOnly ? languages : undefined,
        })
        if (id === requestId.current) setSuggestions(items)
      } catch {
        if (id === requestId.current) setSuggestions([])
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [input, contentRatings, languages, readableOnly])

  return suggestions
}
