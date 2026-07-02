import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useSettings } from '../store/useSettings'
import { loadBackground, subscribeBackgroundChanges } from '../lib/backgroundStore'
import { useObjectUrl } from '../hooks/useObjectUrl'

/**
 * Fixed full-viewport custom background beneath the app. While active,
 * data-custom-bg on <html> remaps --surface to translucency (see index.css)
 * so panels frost over the image.
 */
export default function BackgroundLayer() {
  const background = useSettings((s) => s.background)
  const [blob, setBlob] = useState(null)
  const [version, setVersion] = useState(0)
  const url = useObjectUrl(blob)

  useEffect(() => subscribeBackgroundChanges(() => setVersion((v) => v + 1)), [])

  useEffect(() => {
    let cancelled = false
    if (!background.enabled) {
      setBlob(null)
      return
    }
    loadBackground().then((stored) => {
      if (!cancelled) setBlob(stored ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [background.enabled, version])

  const active = background.enabled && Boolean(url)

  useEffect(() => {
    document.documentElement.dataset.customBg = active ? 'true' : 'false'
  }, [active])

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="custom-bg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 -z-10"
          aria-hidden="true"
        >
          <img
            src={url}
            alt=""
            className="h-full w-full"
            style={{
              objectFit: background.fit,
              filter: `blur(${background.blur}px)`,
              transform: 'scale(1.06)', // hide blur edge bleed
            }}
          />
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: background.dim }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
