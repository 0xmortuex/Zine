import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import Icon from './ui/Icon'

function relativeDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400_000)
  if (days < 1) return 'today'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

/**
 * One node on the chapter spine rail: big tabular chapter number, title,
 * group + date meta, read-state dimming, expandable alternate versions.
 */
export default function ChapterRow({ mangaId, entry, isRead, isCurrent, showAllVersions }) {
  const [expanded, setExpanded] = useState(false)
  const hasAlternates = entry.versions.length > 1

  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, x: -8 },
        show: { opacity: 1, x: 0, transition: { duration: 0.22, ease: 'easeOut' } },
      }}
      className="relative pl-8"
    >
      {/* Spine node */}
      <span
        className={clsx(
          'absolute top-1/2 left-[-4.5px] h-[9px] w-[9px] -translate-y-1/2 rounded-full border-2',
          isCurrent
            ? 'border-accent bg-accent'
            : isRead
              ? 'border-border bg-border'
              : 'border-muted bg-bg',
        )}
        aria-hidden="true"
      />

      <div className={clsx('group flex items-center gap-3 py-2.5', isRead && !isCurrent && 'opacity-50')}>
        <Link
          to={`/read/${mangaId}/${entry.id}`}
          className="focus-ink flex min-w-0 flex-1 items-baseline gap-4 rounded"
        >
          <span
            className={clsx(
              'tnum w-12 shrink-0 text-right text-lg font-bold',
              isCurrent ? 'text-accent' : 'group-hover:text-accent',
            )}
          >
            {entry.chapter ?? '—'}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium group-hover:text-accent">
              {entry.title || `Chapter ${entry.chapter}`}
            </span>
            <span className="block truncate text-xs text-muted">
              {entry.scanlationGroup ?? 'unknown group'} · {relativeDate(entry.publishAt)}
              {entry.pages != null && (
                <>
                  {' '}
                  · <span className="tnum">{entry.pages}</span> pages
                </>
              )}
            </span>
          </span>
        </Link>

        <span className="flex shrink-0 items-center gap-1">
          {isCurrent && <span className="stamp stamp-accent">reading</span>}
          {isRead && !isCurrent && <Icon name="check" size={14} className="text-muted" />}
          {hasAlternates && !showAllVersions && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="stamp focus-ink cursor-pointer hover:text-accent"
              aria-expanded={expanded}
            >
              {entry.versions.length} versions
              <motion.span animate={{ rotate: expanded ? 180 : 0 }} className="inline-flex">
                <Icon name="chevronDown" size={11} />
              </motion.span>
            </button>
          )}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {(expanded || (showAllVersions && hasAlternates)) && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {entry.versions.map((version) => (
              <li key={version.id}>
                <Link
                  to={`/read/${mangaId}/${version.id}`}
                  className={clsx(
                    'focus-ink ml-16 flex items-center gap-2 rounded py-1.5 text-xs hover:text-accent',
                    version.id === entry.id ? 'text-text' : 'text-muted',
                  )}
                >
                  <span className="h-px w-4 bg-border" aria-hidden="true" />
                  {version.scanlationGroup ?? 'unknown group'}
                  <span className="tnum">· {relativeDate(version.publishAt)}</span>
                  {version.id === entry.id && <span className="stamp">canonical</span>}
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

/** External (off-site) chapter — not readable in-app. */
export function ExternalChapterRow({ chapter }) {
  return (
    <li className="relative pl-8 opacity-60">
      <span
        className="absolute top-1/2 left-[-4.5px] h-[9px] w-[9px] -translate-y-1/2 rounded-full border-2 border-border bg-bg"
        aria-hidden="true"
      />
      <a
        href={chapter.externalUrl}
        target="_blank"
        rel="noreferrer"
        className="focus-ink flex items-center gap-4 rounded py-2.5"
      >
        <span className="tnum w-12 shrink-0 text-right text-lg font-bold">
          {chapter.chapter ?? '—'}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span className="truncate">{chapter.title || `Chapter ${chapter.chapter}`}</span>
          <span className="stamp">external</span>
        </span>
        <Icon name="external" size={15} className="shrink-0 text-muted" />
      </a>
    </li>
  )
}
