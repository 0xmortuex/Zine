import { motion } from 'motion/react'
import clsx from 'clsx'
import IconButton from '../ui/IconButton'
import Icon from '../ui/Icon'
import AutoplayRing from './AutoplayRing'

const TICK_RAIL_MAX_PAGES = 48

/**
 * Floating control capsule: chapter skip · page skip · play/pause with the
 * progress ring · scrubber · timer stepper. RTL-aware ("forward" = forward
 * in reading order). On phones (or long chapters) the tick-rail scrubber
 * becomes a full-width native slider with a real touch target, and the
 * capsule stretches edge to edge.
 */
export default function ReaderControls({
  page,
  pageCount,
  direction,
  playing,
  onToggleAutoplay,
  subscribeProgress,
  interval,
  effectiveSeconds,
  onIntervalChange,
  onForward,
  onBack,
  onPrevChapter,
  onNextChapter,
  hasPrevChapter,
  hasNextChapter,
  onScrub,
  mode,
  isMobile,
}) {
  const isRtl = direction === 'rtl'
  const useSlider = isMobile || pageCount > TICK_RAIL_MAX_PAGES

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 24, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={clsx(
        'frosted pointer-events-auto flex flex-col gap-1.5 rounded-2xl border border-border bg-surface shadow-2xl',
        isMobile ? 'w-full px-3 py-2.5' : 'px-4 py-3',
      )}
    >
      {/* Scrubber */}
      {mode === 'paged' && pageCount > 1 && (
        <div className="flex items-center gap-2">
          <span className="tnum shrink-0 text-[0.65rem] font-bold text-muted">{page + 1}</span>
          {useSlider ? (
            <input
              type="range"
              min={0}
              max={pageCount - 1}
              value={page}
              dir={isRtl ? 'rtl' : 'ltr'}
              onChange={(e) => onScrub(Number(e.target.value))}
              aria-label="Page"
              className="focus-ink h-6 min-w-0 flex-1 cursor-pointer touch-none"
              style={{ accentColor: 'var(--accent)' }}
            />
          ) : (
            <div
              className={clsx('flex min-w-0 flex-1 items-center gap-[3px]', isRtl && 'flex-row-reverse')}
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
                    'focus-ink h-5 min-w-0 flex-1 rounded-sm transition-transform duration-150 hover:scale-y-125',
                    i <= page ? 'bg-accent' : 'bg-border',
                    i === page && 'scale-y-150',
                  )}
                  style={{ maxWidth: 10 }}
                />
              ))}
            </div>
          )}
          <span className="tnum shrink-0 text-[0.65rem] font-bold text-muted">{pageCount}</span>
        </div>
      )}

      <div className={clsx('flex items-center', isMobile ? 'justify-between' : 'justify-center gap-1')}>
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
          className="focus-ink relative mx-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg"
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

        {/* Timer stepper — shows the smart per-page time when it differs */}
        <div
          className={clsx(
            'flex items-center gap-1',
            !isMobile && 'ml-2 border-l border-border pl-3',
          )}
        >
          <Icon name="timer" size={14} className="shrink-0 text-muted" />
          <button
            onClick={() => onIntervalChange(Math.max(1, interval - 1))}
            className="focus-ink rounded px-1.5 py-1 text-sm font-bold text-muted hover:text-accent"
            aria-label="Shorter autoplay timer"
          >
            −
          </button>
          <span className="tnum w-9 text-center text-xs leading-tight font-bold">
            {effectiveSeconds != null && Math.round(effectiveSeconds) !== interval ? (
              <>
                {Math.round(effectiveSeconds)}s
                <span className="block text-[0.55rem] font-semibold text-muted">auto</span>
              </>
            ) : (
              `${interval}s`
            )}
          </span>
          <button
            onClick={() => onIntervalChange(Math.min(60, interval + 1))}
            className="focus-ink rounded px-1.5 py-1 text-sm font-bold text-muted hover:text-accent"
            aria-label="Longer autoplay timer"
          >
            +
          </button>
        </div>
      </div>
    </motion.div>
  )
}
