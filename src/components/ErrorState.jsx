import { motion } from 'motion/react'
import Button from './ui/Button'

export default function ErrorState({ error, onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-md py-16 text-center"
    >
      <p className="stamp stamp-accent mb-4">error</p>
      <p className="text-display mb-2 text-xl">Something tore at the seam.</p>
      <p className="mb-6 text-sm text-muted">{error?.message ?? 'Unknown error.'}</p>
      {onRetry && (
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </motion.div>
  )
}
