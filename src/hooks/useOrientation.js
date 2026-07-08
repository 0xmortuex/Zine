import { useEffect, useState } from 'react'

/**
 * Live viewport orientation: 'portrait' when it's at least as tall as it is
 * wide, else 'landscape'. Updates on resize and device/monitor rotation, so
 * pivoting a monitor (e.g. Samsung Odyssey G3) re-lays-out the reader at once.
 */
export function useOrientation() {
  const read = () =>
    typeof window !== 'undefined' && window.innerHeight >= window.innerWidth
      ? 'portrait'
      : 'landscape'

  const [orientation, setOrientation] = useState(read)

  useEffect(() => {
    const update = () => setOrientation(read())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return orientation
}
