import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import Icon from '../ui/Icon'
import PageFailure from './PageFailure'

const FIT_CLASSES = {
  height: 'max-h-full w-auto object-contain',
  width: 'w-full max-w-4xl h-auto object-contain',
  original: 'object-contain',
  // Fill the FULL screen width edge-to-edge (no max-width cap, no side bars).
  // Tall pages become taller than the viewport — the shell scrolls vertically
  // so the whole page is readable, nothing cropped.
  cover: 'w-full h-auto object-contain',
  // Fill the whole viewport with no dead space — used by Book on a portrait
  // screen, where the page and the screen are close enough in shape that the
  // crop is tiny. Scales to cover both axes, trimming the small overflow.
  fillscreen: 'h-full w-full object-cover',
}

const SLIDE = { type: 'spring', stiffness: 420, damping: 38 }

/**
 * Single-page mode: direction-aware spring slide between pages, invisible
 * click/tap zones. On phones the middle HALF toggles the chrome (big thumb
 * target); on desktop the page-turn zones take 40% each side — the pointer
 * is precise, the panel already reveals on mouse move, and side zones show
 * a faint chevron on hover so they're discoverable.
 *
 * When `spread` is set (Book mode on a landscape screen), two consecutive
 * pages sit side by side like an open manga volume. In RTL the current page
 * is on the RIGHT and the next page on the LEFT; `secondUrl` is that partner
 * page (absent on a lone final page).
 */
export default function PagedView({
  url,
  secondUrl,
  spread,
  page,
  slideDirection,
  fit,
  onForward,
  onBack,
  onCenterTap,
  onImageError,
  brokenUrls,
  onRetry,
  isRtl,
  isMobile,
}) {
  const offset = slideDirection * 48
  const isBroken = (pageUrl) => Boolean(pageUrl) && Boolean(brokenUrls?.has(pageUrl))

  const tapZones = (
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
  )

  if (spread) {
    // RTL: right cell holds the current page, left cell the next one.
    const leftUrl = isRtl ? secondUrl : url
    const rightUrl = isRtl ? url : secondUrl
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
        <AnimatePresence mode="popLayout" custom={offset}>
          <motion.div
            key={page}
            initial={{ opacity: 0, x: offset }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -offset }}
            transition={SLIDE}
            className="flex h-full w-full items-center justify-center"
          >
            <SpreadHalf url={leftUrl} alt={`Page ${page + (isRtl ? 2 : 1)}`} onImageError={onImageError} broken={isBroken(leftUrl)} align="end" />
            <SpreadHalf url={rightUrl} alt={`Page ${page + (isRtl ? 1 : 2)}`} onImageError={onImageError} broken={isBroken(rightUrl)} align="start" />
          </motion.div>
        </AnimatePresence>
        {tapZones}
        {/* Failure plates sit above the tap zones (so "Try again" is
            clickable) but only the plate itself takes pointer events — the
            zones around it still turn pages. */}
        {(isBroken(leftUrl) || isBroken(rightUrl)) && (
          <div className="pointer-events-none absolute inset-0 z-20 flex">
            <div className="flex w-1/2 items-center justify-center">
              {isBroken(leftUrl) && <PageFailure pageNumber={page + (isRtl ? 2 : 1)} onRetry={onRetry} />}
            </div>
            <div className="flex w-1/2 items-center justify-center">
              {isBroken(rightUrl) && <PageFailure pageNumber={page + (isRtl ? 1 : 2)} onRetry={onRetry} />}
            </div>
          </div>
        )}
      </div>
    )
  }

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
          onError={() => onImageError(url)}
          initial={{ opacity: 0, x: offset }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -offset }}
          transition={SLIDE}
          // A failed image is hidden (no broken-image icon); PageFailure below takes its place.
          className={clsx('select-none', FIT_CLASSES[fit], isBroken(url) && 'invisible')}
        />
      </AnimatePresence>

      {tapZones}
      {isBroken(url) && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <PageFailure pageNumber={page + 1} onRetry={onRetry} />
        </div>
      )}
    </div>
  )
}

/** One half of a two-page spread; an absent page leaves its half blank so the
 *  partner stays on its correct side (e.g. a lone final page hugs the spine). */
function SpreadHalf({ url, alt, onImageError, broken, align }) {
  return (
    <div
      className={clsx(
        'flex h-full w-1/2 items-center',
        align === 'end' ? 'justify-end' : 'justify-start',
      )}
    >
      {url && (
        <img
          src={url}
          alt={alt}
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => onImageError(url)}
          className={clsx('max-h-full max-w-full object-contain select-none', broken && 'invisible')}
        />
      )}
    </div>
  )
}
