import { useEffect, useState } from 'react'

/**
 * Live viewport orientation: 'portrait' when the viewport is at least as tall
 * as it is wide, else 'landscape'. Updates on rotation and resize so pivoting
 * a monitor (e.g. Samsung Odyssey G3) re-lays-out the reader immediately.
 *
 * We combine three signals for reliability across desktop and mobile:
 *  - matchMedia('(orientation: portrait)') — fires precisely on rotation;
 *  - the Screen Orientation API 'change' — desktop display rotation;
 *  - window 'resize' — catches maximize/restore and anything the above miss.
 * The reported value is always derived from the actual viewport dimensions,
 * which is what the layout ultimately depends on.
 */
export function useOrientation() {
  const read = () =>
    typeof window !== 'undefined' && window.innerHeight >= window.innerWidth
      ? 'portrait'
      : 'landscape'

  const [orientation, setOrientation] = useState(read)

  useEffect(() => {
    const update = () => setOrientation(read())
    update() // reconcile once on mount

    const mql = window.matchMedia?.('(orientation: portrait)')
    mql?.addEventListener?.('change', update)
    window.screen?.orientation?.addEventListener?.('change', update)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)

    return () => {
      mql?.removeEventListener?.('change', update)
      window.screen?.orientation?.removeEventListener?.('change', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return orientation
}
