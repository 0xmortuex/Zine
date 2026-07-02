import { motion } from 'motion/react'
import clsx from 'clsx'
import IconButton from '../ui/IconButton'
import Icon from '../ui/Icon'
import AutoplayRing from './AutoplayRing'

/**
 * Floating control capsule: chapter skip · page skip · play/pause with the
 * progress ring in the capsule edge · tick-rail page scrubber · timer stepper.
 * RTL-aware: "forward" always means forward in reading order.
 */
export default function ReaderControls({
  page,
  pageCount,
  direction,
  playing,
  onToggleAutoplay,
  subscribeProgress,
  interval,
  onIntervalChange,
  onForward,
  onBack,
  onPrevChapter,
  onNextChapter,
  hasPrevChapter,
  hasNextChapter,
  onScrub,
  mode,
}) {
  const isRtl = direction === 'rtl'

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 24, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="frosted pointer-events-auto flex flex-col gap-2 rounded-2xl border border-border bg-surface px-4 py-3 shadow-2xl"
    >
      {/* Tick-rail scrubber (paged mode) */}
      {mode === 'paged' && pageCount > 1 && (
        <div
          className={clsx('flex items-center gap-[3px]', isRtl && 'flex-row-reverse')}
          role="slider"
          aria-label="Page"
          aria-valuemin={1}
          aria-valuemax={pageCount}
          aria-valuenow={page + 1}
        >
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              onClick={() => onScrub(i)}
              aria-label={`Page ${i + 1}`}
              className={clsx(
                'focus-ink h-4 flex-1 rounded-sm transition-transform duration-150 hover:scale-y-125',
                i <= page ? 'bg-accent' : 'bg-border',
                i === page && 'scale-y-150',
              )}
              style={{ minWidth: 2, maxWidth: 10 }}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-1">
        <IconButton
          icon="skipBack"
          label="Previous chapter"
          disabled={!hasPrevChapter}
          onClick={onPrevChapter}
          className={clsx(!hasPrevChapter && 'opacity-30')}
        />
        <IconButton icon="pageBack" label="Back" onClick={onBack} />

        {/* Play/pause with the autoplay ring around it */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onToggleAutoplay}
          aria-label={playing ? 'Pause autoplay' : 'Start autoplay'}
          className="focus-ink relative mx-1 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-fg"
        >
          <AutoplayRing subscribeProgress={subscribeProgress} size={46} />
          <Icon name={playing ? 'pause' : 'play'} size={20} filled={!playing} />
        </motion.button>

        <IconButton icon="pageForward" label="Forward" onClick={onForward} />
        <IconButton
          icon="skipForward"
          label="Next chapter"
          disabled={!hasNextChapter}
          onClick={onNextChapter}
          className={clsx(!hasNextChapter && 'opacity-30')}
        />

        {/* Timer stepper */}
        <div className="ml-2 flex items-center gap-1 border-l border-border pl-3">
          <Icon name="timer" size={14} className="text-muted" />
          <button
            onClick={() => onIntervalChange(Math.max(1, interval - 1))}
            className="focus-ink rounded px-1 text-sm font-bold text-muted hover:text-accent"
            aria-label="Shorter autoplay timer"
          >
            −
          </button>
          <span className="tnum w-7 text-center text-xs font-bold">{interval}s</span>
          <button
            onClick={() => onIntervalChange(Math.min(60, interval + 1))}
            className="focus-ink rounded px-1 text-sm font-bold text-muted hover:text-accent"
            aria-label="Longer autoplay timer"
          >
            +
          </button>
        </div>
      </div>
    </motion.div>
  )
}
