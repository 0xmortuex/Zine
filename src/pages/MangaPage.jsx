import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import clsx from 'clsx'
import PageTransition from '../components/PageTransition'
import ChapterRow, { ExternalChapterRow } from '../components/ChapterRow'
import VolumeSection from '../components/VolumeSection'
import { SkeletonDetailHero, SkeletonRow } from '../components/Skeleton'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import IconButton from '../components/ui/IconButton'
import Toggle from '../components/ui/Toggle'
import Select from '../components/ui/Select'
import { getManga } from '../api'
import { useChapters } from '../hooks/useChapters'
import { useLibrary } from '../store/useLibrary'
import { useSettings } from '../store/useSettings'
import { toast } from '../store/useToasts'
import { dedupeChapters, groupByVolume } from '../lib/chapters'

export default function MangaPage() {
  const { id } = useParams()
  const [manga, setManga] = useState(null)
  const [mangaError, setMangaError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setManga(null)
    setMangaError(null)
    getManga(id).then(
      (result) => !cancelled && setManga(result),
      (err) => !cancelled && setMangaError(err),
    )
    return () => {
      cancelled = true
    }
  }, [id])

  if (mangaError) {
    return (
      <PageTransition>
        <ErrorState error={mangaError} onRetry={() => window.location.reload()} />
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <Link
        to="/"
        className="focus-ink mb-8 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-muted uppercase hover:text-accent"
      >
        <Icon name="arrowLeft" size={14} /> index
      </Link>

      {manga ? <Spread manga={manga} /> : <SkeletonDetailHero />}

      {manga && <Chapters manga={manga} />}
    </PageTransition>
  )
}

/* ------------------------- magazine-spread hero ------------------------- */

function Spread({ manga }) {
  const [descExpanded, setDescExpanded] = useState(false)
  const isFavorite = useLibrary((s) => Boolean(s.favorites[manga.id]))
  const toggleFavorite = useLibrary((s) => s.toggleFavorite)
  const progress = useLibrary((s) => s.progress[manga.id])
  const navigate = useNavigate()

  return (
    <div className="relative mb-14">
      {/* Blurred cover backdrop */}
      {manga.coverUrl && (
        <div className="absolute -inset-x-6 -top-8 bottom-0 -z-10 overflow-hidden" aria-hidden="true">
          <img
            src={manga.coverUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full scale-110 object-cover opacity-20 blur-3xl"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg" />
        </div>
      )}

      <div className="flex flex-col gap-8 md:flex-row md:gap-12">
        {/* Cover plate */}
        <motion.div
          layoutId={`cover-${manga.id}`}
          className="relative aspect-[2/3] w-44 shrink-0 self-start overflow-hidden rounded-lg border border-border shadow-2xl sm:w-56 md:w-64"
        >
          {manga.coverUrl ? (
            <img
              src={manga.coverUrl}
              alt={manga.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-raised text-muted">
              <Icon name="book" size={40} />
            </div>
          )}
        </motion.div>

        {/* Masthead */}
        <div className="min-w-0 flex-1 md:pt-2">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-display mb-1 text-3xl sm:text-5xl"
          >
            {manga.title}
          </motion.h1>
          {manga.altTitles[0] && (
            <p className="mb-4 text-sm text-muted italic">{manga.altTitles[0]}</p>
          )}

          <div className="mb-5 flex flex-wrap items-center gap-2">
            {manga.status && <span className="stamp stamp-accent">{manga.status}</span>}
            {manga.year && <span className="stamp tnum">{manga.year}</span>}
            {manga.contentRating && <span className="stamp">{manga.contentRating}</span>}
          </div>

          {/* Typeset index line of tags */}
          {manga.tags.length > 0 && (
            <p className="mb-5 text-xs tracking-[0.14em] text-muted uppercase">
              {manga.tags.join('  ·  ')}
            </p>
          )}

          {manga.description && (
            <div className="mb-6 max-w-xl">
              <p className={clsx('text-sm leading-relaxed text-text/90', !descExpanded && 'line-clamp-4')}>
                {manga.description}
              </p>
              <button
                onClick={() => setDescExpanded((v) => !v)}
                className="focus-ink mt-1 text-xs font-semibold tracking-wider text-accent uppercase"
              >
                {descExpanded ? 'less' : 'more'}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {progress?.chapterId && (
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate(`/read/${manga.id}/${progress.chapterId}`)}
              >
                <Icon name="play" size={16} filled />
                Continue {progress.chapterLabel} · p.{' '}
                <span className="tnum">{progress.page + 1}</span>
              </Button>
            )}
            <IconButton
              icon="heart"
              filled={isFavorite}
              active={isFavorite}
              size={22}
              label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className="border border-border"
              onClick={() => {
                toggleFavorite(manga)
                toast(isFavorite ? 'Removed from favorites.' : 'Added to favorites.', {
                  kind: isFavorite ? 'info' : 'success',
                })
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------- chapter list ----------------------------- */

const EMPTY_READ = {}

function Chapters({ manga }) {
  const { chapters, loading, progress: loadProgress, error, reload } = useChapters(manga.id)
  const languages = useSettings((s) => s.languages)
  const setLanguages = useSettings((s) => s.setLanguages)
  const readChapters = useLibrary((s) => s.readChapters[manga.id]) ?? EMPTY_READ
  const readingProgress = useLibrary((s) => s.progress[manga.id])
  const navigate = useNavigate()

  const [sortDesc, setSortDesc] = useState(false)
  const [byVolume, setByVolume] = useState(true)
  const [showAllVersions, setShowAllVersions] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)

  const { entries, external } = useMemo(
    () => (chapters ? dedupeChapters(chapters, readChapters) : { entries: [], external: [] }),
    [chapters, readChapters],
  )

  const visible = useMemo(() => {
    let list = entries
    if (unreadOnly) {
      list = list.filter((e) => !e.versions.some((v) => readChapters[v.id]))
    }
    return sortDesc ? [...list].reverse() : list
  }, [entries, unreadOnly, sortDesc, readChapters])

  const volumes = useMemo(() => (byVolume ? groupByVolume(visible) : null), [byVolume, visible])

  const languageOptions = useMemo(() => {
    const available = manga.availableLanguages.length ? manga.availableLanguages : ['en']
    return available.map((lang) => ({ value: lang, label: lang.toUpperCase() }))
  }, [manga.availableLanguages])

  const firstChapter = sortDesc ? visible[visible.length - 1] : visible[0]

  return (
    <section>
      <div className="mb-6 flex items-baseline gap-3">
        <h2 className="text-display text-2xl lowercase">chapters.</h2>
        {chapters && (
          <span className="tnum text-sm text-muted">
            {entries.length}
            {external.length > 0 && ` + ${external.length} external`}
          </span>
        )}
        <div className="rule-h flex-1 self-center" />
      </div>

      {/* Toolbar */}
      <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Select
          value={languages[0]}
          onChange={(lang) => setLanguages([lang])}
          options={languageOptions}
          className="w-28"
        />
        <ToolbarToggle
          label={sortDesc ? 'Newest first' : 'Oldest first'}
          icon={sortDesc ? 'chevronDown' : 'chevronRight'}
          onClick={() => setSortDesc((v) => !v)}
        />
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold tracking-wider text-muted uppercase">
          <Toggle checked={byVolume} onChange={setByVolume} label="Group by volume" />
          volumes
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold tracking-wider text-muted uppercase">
          <Toggle checked={unreadOnly} onChange={setUnreadOnly} label="Unread only" />
          unread
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold tracking-wider text-muted uppercase">
          <Toggle checked={showAllVersions} onChange={setShowAllVersions} label="All versions" />
          all versions
        </label>
        {!readingProgress && firstChapter && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/read/${manga.id}/${firstChapter.id}`)}
          >
            <Icon name="play" size={13} filled /> Start reading
          </Button>
        )}
      </div>

      {loading && (
        <div>
          {loadProgress.total > 0 && (
            <p className="tnum mb-4 text-xs tracking-widest text-muted uppercase">
              loading chapters… {loadProgress.loaded}/{loadProgress.total}
            </p>
          )}
          {Array.from({ length: 8 }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}

      {error && !loading && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && entries.length === 0 && external.length === 0 && (
        <EmptyState
          icon="book"
          title="No chapters in this language."
          hint="Try another translation language in the toolbar above."
        />
      )}

      {!loading && !error && (entries.length > 0 || external.length > 0) && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.015 } } }}
          className="space-y-6"
        >
          {volumes ? (
            volumes.map((group) => (
              <VolumeSection key={group.volume} volume={group.volume} count={group.chapters.length}>
                <ul>
                  {group.chapters.map((entry) => (
                    <ChapterRow
                      key={entry.id}
                      mangaId={manga.id}
                      entry={entry}
                      isRead={entry.versions.some((v) => readChapters[v.id])}
                      isCurrent={entry.versions.some((v) => v.id === readingProgress?.chapterId)}
                      showAllVersions={showAllVersions}
                    />
                  ))}
                </ul>
              </VolumeSection>
            ))
          ) : (
            <div className="relative ml-1.5 border-l border-border">
              <ul>
                {visible.map((entry) => (
                  <ChapterRow
                    key={entry.id}
                    mangaId={manga.id}
                    entry={entry}
                    isRead={entry.versions.some((v) => readChapters[v.id])}
                    isCurrent={entry.versions.some((v) => v.id === readingProgress?.chapterId)}
                    showAllVersions={showAllVersions}
                  />
                ))}
              </ul>
            </div>
          )}

          {external.length > 0 && (
            <VolumeSection volume="external" count={external.length}>
              <ul>
                {external.map((chapter) => (
                  <ExternalChapterRow key={chapter.id} chapter={chapter} />
                ))}
              </ul>
            </VolumeSection>
          )}
        </motion.div>
      )}
    </section>
  )
}

function ToolbarToggle({ label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="focus-ink flex items-center gap-1.5 rounded text-xs font-semibold tracking-wider text-muted uppercase hover:text-accent"
    >
      <Icon name={icon} size={13} />
      {label}
    </button>
  )
}
