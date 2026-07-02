import { useEffect, useState } from 'react'
import { useSettings } from '../store/useSettings'

/**
 * Phone-shaped: narrow viewport, or a touch-first device up to tablet width.
 * Live media query so rotation/resizes re-evaluate.
 */
const MOBILE_QUERY = '(max-width: 767px), ((pointer: coarse) and (max-width: 1024px))'

export function detectMobile() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
}

/**
 * Resolved layout mode: the user's Settings choice ('mobile'/'desktop'),
 * or live device detection when set to 'auto'. Also mirrors the result to
 * <html data-layout> for CSS hooks.
 */
export function useLayoutMode() {
  const preference = useSettings((s) => s.layout)
  const [autoMobile, setAutoMobile] = useState(detectMobile)

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    const onChange = (e) => setAutoMobile(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const mode = preference === 'auto' ? (autoMobile ? 'mobile' : 'desktop') : preference

  useEffect(() => {
    document.documentElement.dataset.layout = mode
  }, [mode])

  return mode
}
