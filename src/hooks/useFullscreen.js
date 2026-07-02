import { useCallback, useEffect, useState } from 'react'

export function useFullscreen(targetRef) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      const el = targetRef?.current ?? document.documentElement
      el.requestFullscreen?.().catch(() => {})
    }
  }, [targetRef])

  return { isFullscreen, toggle }
}
