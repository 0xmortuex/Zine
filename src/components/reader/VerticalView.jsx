import { forwardRef, useCallback, useEffect, useRef } from 'react'
import { pageAtReadingLine } from '../../lib/stripPosition'
import PageFailure from './PageFailure'

/**
 * Webtoon strip mode: continuous vertical scroll. Pages lazy-load via
 * loading="lazy" with aspect-ratio placeholder boxes to avoid scroll jank.
 * Reports the page under the reading line (the middle of the viewport) as
 * the strip scrolls — see lib/stripPosition.js for why it is a line and not
 * a visible-fraction threshold.
 */
const VerticalView = forwardRef(function VerticalView(
  { urls, onPageInView, onTap, onImageError, brokenUrls, onRetry, initialPage = 0 },
  containerRef,
) {
  const pageRefs = useRef([])
  const frame = useRef(0)
  const reported = useRef(-1)

  // Jump to the resume position once per chapter mount.
  useEffect(() => {
    if (initialPage > 0) {
      pageRefs.current[initialPage]?.scrollIntoView({ block: 'start' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls])

  const report = useCallback(() => {
    frame.current = 0
    const root = containerRef?.current
    if (!root) return
    const tops = []
    for (let i = 0; i < urls.length; i++) tops.push(pageRefs.current[i]?.offsetTop ?? 0)
    const index = pageAtReadingLine(tops, root.scrollTop, root.clientHeight, root.scrollHeight)
    if (index !== reported.current) {
      reported.current = index
      onPageInView(index)
    }
  }, [urls, onPageInView, containerRef])

  /** Coalesce bursts of scroll/load/resize events into one measurement per frame. */
  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(report)
  }, [report])

  useEffect(() => {
    const root = containerRef?.current
    if (!root) return
    reported.current = -1
    schedule() // settle on the resume position
    root.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      root.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [schedule, containerRef])

  // Take keyboard focus when nothing else has it, so ↑ ↓ PageUp PageDown
  // Home End scroll the strip natively the moment a chapter opens.
  useEffect(() => {
    if (document.activeElement === document.body) {
      containerRef?.current?.focus({ preventScroll: true })
    }
  }, [containerRef])

  return (
    <div
      ref={containerRef}
      onClick={onTap}
      tabIndex={-1}
      // relative: makes this the offsetParent, so each page's offsetTop is
      // its position within the scrolled content.
      className="no-scrollbar relative h-full w-full overflow-y-auto outline-none"
    >
      <div className="mx-auto flex max-w-3xl flex-col">
        {urls.map((url, index) => (
          <div
            key={url}
            ref={(el) => (pageRefs.current[index] = el)}
            data-page={index}
            className="w-full"
            style={{ aspectRatio: '2 / 3' }}
          >
            {brokenUrls?.has(url) ? (
              <div className="flex h-full w-full items-center justify-center">
                <PageFailure pageNumber={index + 1} onRetry={onRetry} />
              </div>
            ) : (
              <img
                src={url}
                alt={`Page ${index + 1}`}
                referrerPolicy="no-referrer"
                loading="lazy"
                draggable={false}
                // A loaded image replaces its placeholder box with the real
                // height, which moves every page below it.
                onLoad={schedule}
                onError={() => onImageError?.(url)}
                className="h-full w-full object-contain select-none"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
})

export default VerticalView
