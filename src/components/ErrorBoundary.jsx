import { Component } from 'react'
import Button from './ui/Button'

/**
 * Last line of defence: a render error anywhere below this used to unmount
 * the whole app and leave an empty page. It now lands on the same
 * "Something tore at the seam." plate as every other failure, with the
 * actual message and two ways out.
 *
 * Deliberately self-contained — no router hooks, no stores — because either
 * of those may be what broke.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md py-16 text-center" role="alert">
          <p className="stamp stamp-accent mb-4">error</p>
          <p className="text-display mb-2 text-xl">Something tore at the seam.</p>
          <p className="mb-6 text-sm break-words text-muted">
            {error?.message || 'Unknown error.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <a
              href={import.meta.env.BASE_URL}
              className="focus-ink inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-4 py-2 text-sm font-semibold tracking-wide text-text hover:border-accent/60"
            >
              Back to browse
            </a>
          </div>
        </div>
      </div>
    )
  }
}
