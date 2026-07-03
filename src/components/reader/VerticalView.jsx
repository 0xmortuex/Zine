import { forwardRef, useEffect, useRef } from 'react'

/**
 * Webtoon strip mode: continuous vertical scroll. Pages lazy-load via
 * loading="lazy" with aspect-ratio placeholder boxes to avoid scroll jank.
 * Reports the page currently in view via IntersectionObserver.
 */
const VerticalView = forwardRef(function VerticalView(
  { urls, onPageInView, onTap, initialPage = 0 },
  containerRef,
) {
  const pageRefs = useRef([])

  // Jump to the resume position once per chapter mount.
  useEffect(() => {
    if (initialPage > 0) {
      pageRefs.current[initialPage]?.scrollIntoView({ block: 'start' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls])

  useEffect(() => {
    const root = containerRef?.current
    if (!root) return
    const observer = new IntersectionObserver(
      (observations) => {
        for (const entry of observations) {
          if (entry.isIntersecting) {
            onPageInView(Number(entry.target.dataset.page))
          }
        }
      },
      { root, threshold: 0.5 },
    )
    for (const el of pageRefs.current) {
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [urls, onPageInView, containerRef])

  return (
    <div
      ref={containerRef}
      onClick={onTap}
      className="no-scrollbar h-full w-full overflow-y-auto"
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
            <img
              src={url}
              alt={`Page ${index + 1}`}
              referrerPolicy="no-referrer"
              loading="lazy"
              draggable={false}
              className="h-full w-full object-contain select-none"
            />
          </div>
        ))}
      </div>
    </div>
  )
})

export default VerticalView
