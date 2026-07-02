import { Link } from 'react-router-dom'
import PageTransition from '../components/PageTransition'

export default function NotFoundPage() {
  return (
    <PageTransition className="py-20 text-center">
      <p className="tnum text-display text-7xl text-accent">404</p>
      <p className="text-display mt-4 mb-2 text-2xl lowercase">page not in this issue.</p>
      <p className="mb-8 text-sm text-muted">The address doesn’t match anything in the index.</p>
      <Link
        to="/"
        className="focus-ink inline-flex rounded-md bg-accent px-6 py-3 font-semibold text-accent-fg hover:brightness-110"
      >
        Back to browse
      </Link>
    </PageTransition>
  )
}
