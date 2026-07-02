import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import PagedView from '../components/reader/PagedView'
import VerticalView from '../components/reader/VerticalView'
import ReaderControls from '../components/reader/ReaderControls'
import ReaderSettingsSheet from '../components/reader/ReaderSettingsSheet'
import ErrorState from '../components/ErrorState'
import Icon from '../components/ui/Icon'
import IconButton from '../components/ui/IconButton'
import Button from '../components/ui/Button'
import { getChapterPages, getManga } from '../api'
import { useChapters } from '../hooks/useChapters'
import { useAutoplay } from '../hooks/useAutoplay'
import { useKeyboard } from '../hooks/useKeyboard'
import { useFullscreen } from '../hooks/useFullscreen'
import { useSettings } from '../store/useSettings'
import { useLibrary } from '../store/useLibrary'
import { createPreloader, isStale } from '../lib/preload'
import { dedupeChapters, findPrevNext, formatChapterLabel } from '../lib/chapters'

const CHROME_IDLE_MS = 2500
const INTERSTITIAL_SECONDS = 3
const EMPTY_READ = {}

export default function ReaderPage() {
  const { mangaId, chapterId } = useParams()
  const navigate = useNavigate()

  const reader = useSettings((s) => s.reader)
  const setReader = useSettings((s) => s.setReader)
  const readChapters = useLibrary((s) => s.readChapters[mangaId]) ?? EMPTY_READ
  const setProgress = useLibrary((s) => s.setProgress)
  const markRead = useLibrary((s) => s.markRead)
  const pushHistory = useLibrary((s) => s.pushHistory)

  const [manga, setManga] = useState(null)
  const { chapters } = useChapters(mangaId)
  const [pageSet, setPageSet] = useState(null) // { urls, fetchedAt }
  const [pagesError, setPagesError] = useState(null)
  const [page, setPage] = useState(0)
  const [slideDirection, setSlideDirection] = useState(1)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [interstitial, setInterstitial] = useState(false)

  const shellRef = useRef(null)
  const verticalRef = useRef(null)
  const idleTimer = useRef(null)
  const refetchedOnce = useRef(false)
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(shellRef)

  /* ------------------------------ data load ------------------------------ */

  useEffect(() => {
    let cancelled = false
    getManga(mangaId).then((m) => !cancelled && setManga(m), () => {})
    return () => {
      cancelled = true
    }
  }, [mangaId])

  const loadPages = useCallback(async () => {
    setPageSet(null)
    setPagesError(null)
    try {
      const urls = await getChapterPages(chapterId, { dataSaver: reader.dataSaver })
      setPageSet({ urls, fetchedAt: Date.now() })
    } catch (err) {
      setPagesError(err)
    }
  }, [chapterId, reader.dataSaver])

  useEffect(() => {
    refetchedOnce.current = false
    setPage(0)
    setInterstitial(false)
    loadPages()
  }, [loadPages])

  const urls = pageSet?.urls ?? []
  const pageCount = urls.length

  const preloader = useMemo(() => (pageSet ? createPreloader(pageSet.urls) : null), [pageSet])

  useEffect(() => {
    if (reader.mode === 'paged') preloader?.warmAround(page, reader.preloadCount)
  }, [preloader, page, reader.preloadCount, reader.mode])

  /* ------------------------- chapter context/nav ------------------------- */

  const { entries } = useMemo(
    () => (chapters ? dedupeChapters(chapters, readChapters) : { entries: [], external: [] }),
    [chapters, readChapters],
  )
  const { prev, next, current } = useMemo(
    () => findPrevNext(entries, chapterId),
    [entries, chapterId],
  )
  const chapterLabel = current ? formatChapterLabel(current) : ''

  /* ------------------------ progress + history ------------------------- */

  useEffect(() => {
    if (!pageCount || !current) return
    setProgress(mangaId, {
      chapterId,
      chapterLabel: formatChapterLabel(current),
      page,
      totalPages: pageCount,
    })
    if (page === pageCount - 1) markRead(mangaId, chapterId)
  }, [page, pageCount, mangaId, chapterId, current, setProgress, markRead])

  useEffect(() => {
    if (!manga || !current) return
    pushHistory({
      mangaId,
      title: manga.title,
      coverThumbUrl: manga.coverThumbUrl,
      chapterId,
      chapterLabel: formatChapterLabel(current),
    })
  }, [manga, current, mangaId, chapterId, pushHistory])

  /* ------------------------------ navigation ----------------------------- */

  const goToChapter = useCallback(
    (entry) => {
      if (entry) navigate(`/read/${mangaId}/${entry.id}`)
    },
    [navigate, mangaId],
  )

  const goForward = useCallback(async () => {
    if (!pageCount) return false
    if (pageSet && isStale(pageSet.fetchedAt)) {
      await loadPages() // page URLs expired mid-read; refresh transparently
      return true
    }
    if (page < pageCount - 1) {
      setSlideDirection(1)
      setPage((p) => p + 1)
      return true
    }
    if (next) {
      setInterstitial(true)
      return true
    }
    return false
  }, [page, pageCount, next, pageSet, loadPages])

  const goBack = useCallback(() => {
    if (page > 0) {
      setSlideDirection(-1)
      setPage((p) => p - 1)
    } else if (prev) {
      goToChapter(prev)
    }
  }, [page, prev, goToChapter])

  /* ------------------------------- autoplay ------------------------------ */

  const autoplayEnabled =
    pageCount > 0 && !sheetOpen && !interstitial && reader.mode === 'paged'

  const handleAutoplayComplete = useCallback(async () => {
    if (page < pageCount - 1) {
      await preloader?.whenReady(page + 1) // hold at 100% until the image is in
      setSlideDirection(1)
      setPage((p) => p + 1)
      return true
    }
    if (next) {
      setInterstitial(true)
      return true
    }
    return false // last page of last chapter — stop
  }, [page, pageCount, next, preloader])

  const autoplay = useAutoplay({
    duration: reader.autoplayInterval * 1000,
    onComplete: handleAutoplayComplete,
    resetKey: `${chapterId}:${page}`,
    enabled: autoplayEnabled,
  })

  /* --------------------- vertical mode: auto-scroll ---------------------- */

  const [verticalPlaying, setVerticalPlaying] = useState(false)
  const verticalListeners = useRef(new Set())
  const subscribeVertical = useCallback((listener) => {
    verticalListeners.current.add(listener)
    return () => verticalListeners.current.delete(listener)
  }, [])

  const emitVerticalProgress = useCallback(() => {
    const el = verticalRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const progress = max > 0 ? el.scrollTop / max : 0
    for (const listener of verticalListeners.current) listener(progress)
  }, [])

  useEffect(() => {
    if (reader.mode !== 'vertical' || !verticalPlaying) return
    let frame
    let last = null
    const tick = (ts) => {
      const el = verticalRef.current
      if (el) {
        if (last != null) {
          el.scrollTop += (reader.autoScrollSpeed * (ts - last)) / 1000
          emitVerticalProgress()
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
            setVerticalPlaying(false)
            if (next) setInterstitial(true)
          }
        }
        last = ts
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [reader.mode, verticalPlaying, reader.autoScrollSpeed, emitVerticalProgress, next])

  // Wheel/touch input pauses auto-scroll.
  useEffect(() => {
    if (reader.mode !== 'vertical') return
    const el = verticalRef.current
    if (!el) return
    const pause = () => setVerticalPlaying(false)
    const onScroll = () => emitVerticalProgress()
    el.addEventListener('wheel', pause, { passive: true })
    el.addEventListener('touchstart', pause, { passive: true })
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('wheel', pause)
      el.removeEventListener('touchstart', pause)
      el.removeEventListener('scroll', onScroll)
    }
  }, [reader.mode, pageSet, emitVerticalProgress])

  const playing = reader.mode === 'paged' ? autoplay.playing : verticalPlaying
  const toggleAutoplay = useCallback(() => {
    if (reader.mode === 'paged') autoplay.toggle()
    else setVerticalPlaying((v) => !v)
  }, [reader.mode, autoplay])

  /* ----------------------------- chrome idle ----------------------------- */

  const pokeChrome = useCallback(() => {
    setChromeVisible(true)
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setChromeVisible(false), CHROME_IDLE_MS)
  }, [])

  useEffect(() => {
    pokeChrome()
    return () => clearTimeout(idleTimer.current)
  }, [pokeChrome])

  const handleCenterTap = useCallback(() => {
    if (reader.tapToPause && playing) {
      toggleAutoplay()
      return
    }
    setChromeVisible((visible) => {
      clearTimeout(idleTimer.current)
      if (!visible) idleTimer.current = setTimeout(() => setChromeVisible(false), CHROME_IDLE_MS)
      return !visible
    })
  }, [reader.tapToPause, playing, toggleAutoplay])

  /* ------------------------------- keyboard ------------------------------ */

  const isRtl = reader.direction === 'rtl'
  useKeyboard({
    ArrowRight: () => (isRtl && reader.mode === 'paged' ? goBack() : goForward()),
    ArrowLeft: () => (isRtl && reader.mode === 'paged' ? goForward() : goBack()),
    ' ': toggleAutoplay,
    f: toggleFullscreen,
    F: toggleFullscreen,
    m: () => setReader({ mode: reader.mode === 'paged' ? 'vertical' : 'paged' }),
    ',': () => setReader({ autoplayInterval: Math.max(1, reader.autoplayInterval - 1) }),
    '.': () => setReader({ autoplayInterval: Math.min(60, reader.autoplayInterval + 1) }),
    Escape: () => navigate(`/manga/${mangaId}`),
  })

  /* -------------------------------- render ------------------------------- */

  const handleImageError = useCallback(() => {
    if (!refetchedOnce.current) {
      refetchedOnce.current = true
      loadPages()
    }
  }, [loadPages])

  return (
    <motion.div
      ref={shellRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseMove={pokeChrome}
      className="fixed inset-0 flex flex-col bg-bg"
    >
      {pagesError && (
        <div className="flex flex-1 items-center justify-center">
          <ErrorState error={pagesError} onRetry={loadPages} />
        </div>
      )}

      {!pagesError && !pageSet && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
            className="h-8 w-8 rounded-full border-2 border-border border-t-accent"
          />
          <p className="text-xs tracking-[0.2em] uppercase">fetching pages…</p>
        </div>
      )}

      {!pagesError && pageSet && (
        <div className="relative flex-1 overflow-hidden">
          {reader.mode === 'paged' ? (
            <PagedView
              url={urls[page]}
              page={page}
              slideDirection={isRtl ? -slideDirection : slideDirection}
              fit={reader.fit}
              onForward={goForward}
              onBack={goBack}
              onCenterTap={handleCenterTap}
              onImageError={handleImageError}
              isRtl={isRtl}
            />
          ) : (
            <VerticalView
              ref={verticalRef}
              urls={urls}
              onPageInView={setPage}
              onTap={handleCenterTap}
            />
          )}
        </div>
      )}

      {/* Top chrome */}
      <AnimatePresence>
        {chromeVisible && (
          <motion.header
            initial={{ y: -56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -56, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="frosted absolute inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5"
          >
            <Link
              to={`/manga/${mangaId}`}
              className="focus-ink flex items-center gap-2 rounded text-muted hover:text-accent"
              aria-label="Back to manga"
            >
              <Icon name="arrowLeft" size={18} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{manga?.title ?? '…'}</p>
              <p className="truncate text-xs text-muted">{chapterLabel}</p>
            </div>
            <span className="tnum text-xs text-muted">
              {pageCount ? `${page + 1} / ${pageCount}` : ''}
            </span>
            <IconButton
              icon={reader.mode === 'paged' ? 'columns' : 'rows'}
              label="Switch reading mode"
              onClick={() => setReader({ mode: reader.mode === 'paged' ? 'vertical' : 'paged' })}
            />
            <IconButton
              icon={isFullscreen ? 'minimize' : 'fullscreen'}
              label="Fullscreen"
              onClick={toggleFullscreen}
            />
            <IconButton icon="settings" label="Reader settings" onClick={() => setSheetOpen(true)} />
          </motion.header>
        )}
      </AnimatePresence>

      {/* Bottom chrome: floating control capsule */}
      <AnimatePresence>
        {chromeVisible && pageSet && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
            <ReaderControls
              page={page}
              pageCount={pageCount}
              direction={reader.direction}
              playing={playing}
              onToggleAutoplay={toggleAutoplay}
              subscribeProgress={
                reader.mode === 'paged' ? autoplay.subscribeProgress : subscribeVertical
              }
              interval={reader.autoplayInterval}
              onIntervalChange={(autoplayInterval) => setReader({ autoplayInterval })}
              onForward={goForward}
              onBack={goBack}
              onPrevChapter={() => goToChapter(prev)}
              onNextChapter={() => goToChapter(next)}
              hasPrevChapter={Boolean(prev)}
              hasNextChapter={Boolean(next)}
              onScrub={(target) => {
                setSlideDirection(target > page ? 1 : -1)
                setPage(target)
              }}
              mode={reader.mode}
            />
          </div>
        )}
      </AnimatePresence>

      <ReaderSettingsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />

      <NextChapterInterstitial
        active={interstitial}
        next={next}
        onCancel={() => setInterstitial(false)}
        onGo={() => {
          setInterstitial(false)
          goToChapter(next)
        }}
      />
    </motion.div>
  )
}

/** Cancellable "next chapter in 3…" overlay at chapter end. */
function NextChapterInterstitial({ active, next, onCancel, onGo }) {
  const [count, setCount] = useState(INTERSTITIAL_SECONDS)
  const onGoRef = useRef(onGo)
  onGoRef.current = onGo

  useEffect(() => {
    if (!active) return
    setCount(INTERSTITIAL_SECONDS)
    const interval = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(interval)
          onGoRef.current()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [active])

  return (
    <AnimatePresence>
      {active && next && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/70"
        >
          <motion.div
            initial={{ scale: 0.92, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="frosted mx-4 rounded-2xl border border-border bg-surface p-8 text-center"
          >
            <p className="mb-1 text-xs tracking-[0.2em] text-muted uppercase">chapter finished</p>
            <p className="text-display mb-4 text-2xl">
              Next: {formatChapterLabel(next)}
            </p>
            <p className="tnum mb-6 text-5xl font-bold text-accent">{count}</p>
            <div className="flex justify-center gap-3">
              <Button onClick={onCancel}>Stay here</Button>
              <Button variant="primary" onClick={onGo}>
                <Icon name="skipForward" size={14} /> Go now
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
