import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import PageTransition from '../components/PageTransition'
import MangaGrid from '../components/MangaGrid'
import { SkeletonGrid } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import { useMangaSearch } from '../hooks/useMangaSearch'
import { useLibrary } from '../store/useLibrary'
import { useSettings } from '../store/useSettings'
import { toast } from '../store/useToasts'
import LocalShelf from '../components/LocalShelf'
import { getPopularManga, getTrendingManga } from '../api'

const TABS = [
  { id: 'search', label: 'browse', heading: 'browse.', sub: 'Search the MangaDex catalogue.' },
  { id: 'library', label: 'library', heading: 'library.', sub: 'Your favorited series.' },
  { id: 'history', label: 'history', heading: 'history.', sub: 'Recently read, newest first.' },
]

export default function HomePage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'search'
  const active = TABS.find((t) => t.id === tab)

  return (
    <PageTransition>
      <section className="mb-8">
        <h2 className="text-display mb-1 text-4xl lowercase sm:text-5xl">{active.heading}</h2>
        <p className="text-sm text-muted">{active.sub}</p>
      </section>

      {/* Tab rail */}
      <div className="mb-10 flex items-center gap-6 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setParams(t.id === 'search' ? {} : { tab: t.id })}
            className={clsx(
              'focus-ink relative pb-3 text-xs font-bold tracking-[0.2em] uppercase',
              tab === t.id ? 'text-accent' : 'text-muted hover:text-text',
            )}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {t.label}
            {tab === t.id && (
              <motion.span
                layoutId="home-tab-ink"
                className="absolute inset-x-0 -bottom-px h-0.5 bg-accent"
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {tab === 'search' && <SearchTab />}
          {tab === 'library' && <LibraryTab />}
          {tab === 'history' && <HistoryTab />}
        </motion.div>
      </AnimatePresence>
    </PageTransition>
  )
}

/* --------------------------------- search -------------------------------- */

function SearchTab() {
  const { query, items, loading, loadingMore, error, search, loadMore, hasMore } =
    useMangaSearch()
  const [input, setInput] = useState('')
  const [params] = useSearchParams()

  // ?q= deep links (e.g. a MAL rail card handing off to a title search).
  const linkedQuery = params.get('q')
  useEffect(() => {
    if (linkedQuery && linkedQuery !== query) {
      setInput(linkedQuery)
      search(linkedQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedQuery])

  function handleSubmit(event) {
    event.preventDefault()
    search(input)
  }

  return (
    <>
      <ContinueShelf />

      <form onSubmit={handleSubmit} className="mb-12 flex max-w-2xl gap-2">
        <div className="group/ink relative flex-1">
          <span className="ink-plate rounded-md" />
          <div className="relative flex items-center rounded-md border border-border bg-surface-raised focus-within:border-accent">
            <span className="pl-3 text-muted">
              <Icon name="search" size={17} />
            </span>
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Title, e.g. “one punch man”…"
              className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted"
            />
          </div>
        </div>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {loading && !items && <SkeletonGrid />}

      {error && !loading && <ErrorState error={error} onRetry={() => search(query)} />}

      {!loading && !error && items?.length === 0 && (
        <EmptyState
          icon="search"
          title="Nothing in the index."
          hint={`No results for “${query}”. Try a shorter title or a different spelling.`}
        />
      )}

      {items?.length > 0 && !error && (
        <>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 text-[0.65rem] font-semibold tracking-[0.2em] text-muted uppercase"
          >
            showing <span className="tnum">{items.length}</span>
            {hasMore && '+'} results
            {loading && <span className="ml-2 normal-case">· still searching other sources…</span>}
          </motion.p>
          <MangaGrid items={items} />
          {hasMore && (
            <div className="mt-12 flex justify-center">
              <Button onClick={loadMore} disabled={loadingMore} size="lg">
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}

      {!loading && !error && items === null && <DiscoverRails />}
    </>
  )
}

/** "trending now." and "most popular." rails shown before any search. */
function DiscoverRails() {
  const languages = useSettings((s) => s.languages)
  const readableOnly = useSettings((s) => s.readableOnly)
  const contentRatings = useSettings((s) => s.contentRatings)
  const [trending, setTrending] = useState(null)
  const [popular, setPopular] = useState(null)

  useEffect(() => {
    let cancelled = false
    const opts = {
      limit: 12,
      contentRatings,
      availableLanguages: readableOnly ? languages : undefined,
    }
    getTrendingManga(opts).then((items) => !cancelled && setTrending(items))
    getPopularManga(opts).then((items) => !cancelled && setPopular(items))
    return () => {
      cancelled = true
    }
  }, [languages, readableOnly, contentRatings])

  const failed = trending?.length === 0 && popular?.length === 0

  return (
    <>
      <DiscoverSection title="trending now." items={trending} />
      <DiscoverSection title="most popular." items={popular} />
      {failed && (
        <EmptyState
          icon="book"
          title="Your index is open."
          hint="The discovery rails couldn't load right now — search for a title above, or retry in a minute."
        />
      )}
    </>
  )
}

function DiscoverSection({ title, items }) {
  if (items?.length === 0) return null
  return (
    <section className="mb-12">
      <div className="mb-5 flex items-baseline gap-3">
        <h3 className="text-display text-lg lowercase">{title}</h3>
        <div className="rule-h flex-1 self-center" />
      </div>
      {items === null ? <SkeletonGrid count={6} /> : <MangaGrid items={items} />}
    </section>
  )
}

/** "Continue reading" shelf: history entries joined with saved progress. */
function ContinueShelf() {
  const history = useLibrary((s) => s.history)
  const progress = useLibrary((s) => s.progress)

  const entries = history
    .filter((h) => progress[h.mangaId])
    .slice(0, 8)
    .map((h) => ({ ...h, progress: progress[h.mangaId] }))

  if (entries.length === 0) return null

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-baseline gap-3">
        <h3 className="text-display text-lg lowercase">continue reading.</h3>
        <div className="rule-h flex-1 self-center" />
      </div>
      <motion.ul
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
        className="no-scrollbar flex gap-4 overflow-x-auto pb-2"
      >
        {entries.map((entry) => {
          const ratio =
            entry.progress.totalPages > 0
              ? (entry.progress.page + 1) / entry.progress.totalPages
              : 0
          return (
            <motion.li
              key={entry.mangaId}
              variants={{
                hidden: { opacity: 0, x: 16 },
                show: { opacity: 1, x: 0, transition: { duration: 0.25 } },
              }}
              className="w-56 shrink-0"
            >
              <Link
                to={`/read/${entry.mangaId}/${entry.progress.chapterId}`}
                className="focus-ink group flex gap-3 rounded-lg border border-border bg-surface p-3 hover:border-accent/60"
              >
                <span className="block h-20 w-14 shrink-0 overflow-hidden rounded border border-border">
                  {entry.coverThumbUrl && (
                    <img
                      src={entry.coverThumbUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                  <span>
                    <span className="line-clamp-2 text-xs leading-snug font-semibold group-hover:text-accent">
                      {entry.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[0.7rem] text-muted">
                      {entry.progress.chapterLabel} · p.{' '}
                      <span className="tnum">{entry.progress.page + 1}</span>
                    </span>
                  </span>
                  <span className="block h-1 overflow-hidden rounded-full bg-border">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </span>
                </span>
              </Link>
            </motion.li>
          )
        })}
      </motion.ul>
    </section>
  )
}

/* -------------------------------- library -------------------------------- */

function LibraryTab() {
  const favorites = useLibrary((s) => s.favorites)
  const items = Object.values(favorites)
    .sort((a, b) => b.addedAt - a.addedAt)
    .map((f) => f.manga)

  return (
    <>
      <LocalShelf />

      <div className="mb-4 flex items-baseline gap-3">
        <h3 className="text-display text-lg lowercase">favorites.</h3>
        {items.length > 0 && <span className="tnum text-sm text-muted">{items.length}</span>}
        <div className="rule-h flex-1 self-center" />
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon="heart"
          title="No favorites yet."
          hint="Tap the heart on any series to shelve it here."
        />
      ) : (
        <MangaGrid items={items} />
      )}
    </>
  )
}

/* -------------------------------- history -------------------------------- */

function HistoryTab() {
  const history = useLibrary((s) => s.history)
  const clearHistory = useLibrary((s) => s.clearHistory)

  if (history.length === 0) {
    return (
      <EmptyState
        icon="history"
        title="Nothing read yet."
        hint="Chapters you open will be catalogued here."
      />
    )
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            clearHistory()
            toast('History cleared.')
          }}
        >
          <Icon name="trash" size={13} /> Clear history
        </Button>
      </div>
      <motion.ul
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.03 } } }}
        className="relative ml-1.5 border-l border-border"
      >
        {history.map((entry) => (
          <motion.li
            key={`${entry.mangaId}-${entry.at}`}
            variants={{
              hidden: { opacity: 0, x: -8 },
              show: { opacity: 1, x: 0, transition: { duration: 0.2 } },
            }}
            className="relative pl-8"
          >
            <span
              className="absolute top-1/2 left-[-4.5px] h-[9px] w-[9px] -translate-y-1/2 rounded-full border-2 border-muted bg-bg"
              aria-hidden="true"
            />
            <div className="flex items-center gap-4 py-3">
              <Link
                to={`/manga/${entry.mangaId}`}
                className="focus-ink block h-16 w-11 shrink-0 overflow-hidden rounded border border-border"
              >
                {entry.coverThumbUrl && (
                  <img
                    src={entry.coverThumbUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/manga/${entry.mangaId}`}
                  className="focus-ink block truncate text-sm font-semibold hover:text-accent"
                >
                  {entry.title}
                </Link>
                <p className="truncate text-xs text-muted">
                  {entry.chapterLabel} ·{' '}
                  {new Date(entry.at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <Link
                to={`/read/${entry.mangaId}/${entry.chapterId}`}
                className="focus-ink flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold tracking-wider text-muted uppercase hover:border-accent hover:text-accent"
              >
                <Icon name="play" size={11} filled /> resume
              </Link>
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  )
}
