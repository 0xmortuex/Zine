import { motion } from 'motion/react'
import Icon from './ui/Icon'

export default function EmptyState({ icon = 'book', title, hint }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center gap-3 py-20 text-center"
    >
      <span className="rounded-full border border-border p-4 text-muted">
        <Icon name={icon} size={28} />
      </span>
      <p className="text-display text-xl">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
    </motion.div>
  )
}
