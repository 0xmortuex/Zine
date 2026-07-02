import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useLibrary } from '../store/useLibrary'
import Icon from './ui/Icon'

/**
 * Editorial result card: cover plate with a risograph offset ink-plate on
 * hover, title as the lead element, status as a print stamp, reading
 * progress as a hairline bar.
 */
export default function MangaCard({ manga }) {
  const isFavorite = useLibrary((s) => Boolean(s.favorites[manga.id]))
  const progress = useLibrary((s) => s.progress[manga.id])

  const progressRatio =
    progress && progress.totalPages > 0
      ? Math.min(1, (progress.page + 1) / progress.totalPages)
      : null

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
      }}
    >
      <Link
        to={`/manga/${manga.id}`}
        className="focus-ink group/ink group block"
        aria-label={manga.title}
      >
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="relative"
        >
          <span className="ink-plate rounded-lg" />
          <motion.div
            layoutId={`cover-${manga.id}`}
            className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface-raised"
          >
            {manga.coverThumbUrl ? (
              <img
                src={manga.coverThumbUrl}
                alt=""
                referrerPolicy="no-referrer"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted">
                <Icon name="book" size={32} />
              </div>
            )}
            {isFavorite && (
              <span className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-accent backdrop-blur-sm">
                <Icon name="heart" size={13} filled />
              </span>
            )}
            {progressRatio !== null && (
              <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                <span
                  className="block h-full bg-accent"
                  style={{ width: `${Math.round(progressRatio * 100)}%` }}
                />
              </span>
            )}
          </motion.div>
        </motion.div>

        <div className="mt-3 space-y-1.5">
          <p className="line-clamp-2 leading-snug font-semibold tracking-tight group-hover:text-accent">
            {manga.title}
          </p>
          <p className="flex items-center gap-2">
            {manga.year && <span className="tnum text-xs text-muted">{manga.year}</span>}
            {manga.status && <span className="stamp">{manga.status}</span>}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}
