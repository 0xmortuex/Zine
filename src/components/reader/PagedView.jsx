import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import Icon from '../ui/Icon'

const FIT_CLASSES = {
  height: 'max-h-full w-auto object-contain',
  width: 'w-full max-w-4xl h-auto object-contain',
  original: 'object-contain',
  // Fill the FULL screen width edge-to-edge (no max-width cap, no side bars).
  // Tall pages become taller than the viewport — the shell scrolls vertically
  // so the whole page is readable, nothing cropped.
  cover: 'w-full h-auto object-contain',
}

/**
 * Single-page mode: direction-aware spring slide between pages, invisible
 * click/tap zones. On phones the middle HALF toggles the chrome (big thumb
 * target); on desktop the page-turn zones take 40% each side — the pointer
 * is precise, the panel already reveals on mouse move, and side zones show
 * a faint chevron on hover so they're discoverable.
 */
export default function PagedView({
  url,
  page,
  slideDirection,
  fit,
  onForward,
  onBack,
  onCenterTap,
  onImageError,
  isRtl,
  isMobile,
}) {
  const offset = slideDirection * 48

  return (
    <div
      className={clsx(
        'relative flex h-full w-full justify-center',
        // Full-width Fill scrolls from the top so no part of a tall page is
        // stranded above the fold; other fits stay vertically centered.
        fit === 'cover'
          ? 'items-start overflow-y-auto'
          : fit === 'width'
            ? 'items-center overflow-y-auto'
            : 'items-center overflow-hidden',
      )}
    >
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
          className={clsx('select-none', FIT_CLASSES[fit])}
        />
      </AnimatePresence>

      <div
        className={clsx(
          'absolute inset-0 z-10 grid',
          isMobile ? 'grid-cols-[1fr_2fr_1fr]' : 'grid-cols-[2fr_1fr_2fr]',
        )}
      >
        <button
          aria-label={isRtl ? 'Next page' : 'Previous page'}
          onClick={isRtl ? onForward : onBack}
          className="group flex cursor-w-resize items-center justify-start pl-4 outline-none"
        >
          {!isMobile && (
            <span className="rounded-full bg-surface/70 p-2 text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-80">
              <Icon name="chevronLeft" size={22} />
            </span>
          )}
        </button>
        <button aria-label="Toggle controls" onClick={onCenterTap} className="outline-none" />
        <button
          aria-label={isRtl ? 'Previous page' : 'Next page'}
          onClick={isRtl ? onBack : onForward}
          className="group flex cursor-e-resize items-center justify-end pr-4 outline-none"
        >
          {!isMobile && (
            <span className="rounded-full bg-surface/70 p-2 text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-80">
              <Icon name="chevronRight" size={22} />
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
