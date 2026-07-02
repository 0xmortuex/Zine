import { useEffect, useRef } from 'react'

/**
 * Declarative keyboard shortcut map: { 'ArrowLeft': fn, ' ': fn, f: fn }.
 * Skips events targeting form fields.
 */
export function useKeyboard(map) {
  const mapRef = useRef(map)
  mapRef.current = map

  useEffect(() => {
    function onKeyDown(event) {
      const target = event.target
      if (target instanceof HTMLElement && /^(input|textarea|select)$/i.test(target.tagName)) {
        return
      }
      const handler = mapRef.current[event.key]
      if (handler) {
        event.preventDefault()
        handler(event)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
