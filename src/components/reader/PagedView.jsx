import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'

const FIT_CLASSES = {
  height: 'max-h-full w-auto',
  width: 'w-full max-w-4xl h-auto',
  original: '',
}

/**
 * Single-page mode: direction-aware spring slide between pages, invisible
 * tap zones (back | pause | forward, honoring RTL).
 */
export default function PagedView({ url, page, slideDirection, fit, onForward, onBack, onCenterTap, onImageError, isRtl }) {
  const offset = slideDirection * 48

  return (
    <div className={clsx('relative flex h-full w-full items-center', fit === 'width' ? 'overflow-y-auto justify-center' : 'justify-center overflow-hidden')}>
      <AnimatePresence mode="popLayout" custom={offset}>
        <motion.img
          key={page}
          src={url}
          alt={`Page ${page + 1}`}
          referrerPolicy="no-referrer"
          draggable={false}
          onError={onImageError}
          initial={{ opacity: 0, x: offset }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -offset }}
          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          className={clsx('object-contain select-none', FIT_CLASSES[fit])}
        />
      </AnimatePresence>

      {/* Tap zones: outer thirds page, middle third toggles chrome/autoplay */}
      <div className="absolute inset-0 z-10 grid grid-cols-3">
        <button
          aria-label={isRtl ? 'Next page' : 'Previous page'}
          onClick={isRtl ? onForward : onBack}
          className="cursor-w-resize outline-none"
        />
        <button aria-label="Toggle controls" onClick={onCenterTap} className="outline-none" />
        <button
          aria-label={isRtl ? 'Previous page' : 'Next page'}
          onClick={isRtl ? onBack : onForward}
          className="cursor-e-resize outline-none"
        />
      </div>
    </div>
  )
}
