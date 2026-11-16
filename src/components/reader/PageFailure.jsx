import Button from '../ui/Button'

/**
 * Stands in for a page image that failed to load, after the reader's one
 * automatic re-fetch has already been tried. Without it the reader showed
 * the browser's broken-image icon and nothing else: no explanation, no way
 * to retry short of reloading.
 *
 * "Try again" asks for the chapter's page list afresh — for MangaDex that
 * normally hands out a different image server.
 */
export default function PageFailure({ pageNumber, onRetry }) {
  return (
    <div className="pointer-events-auto flex max-w-xs flex-col items-center gap-3 px-6 py-8 text-center">
      <p className="stamp stamp-accent">
        page <span className="tnum">{pageNumber}</span>
      </p>
      <p className="text-display text-xl">This page didn’t arrive.</p>
      <p className="text-sm text-muted">
        The image failed to load. Asking again usually reaches a different server.
      </p>
      <Button
        variant="primary"
        onClick={(event) => {
          event.stopPropagation() // not a tap on the page
          onRetry()
        }}
      >
        Try again
      </Button>
    </div>
  )
}
