import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { useToasts } from '../store/useToasts'
import Icon from './ui/Icon'

const KIND_STYLES = {
  info: 'border-border',
  success: 'border-accent/60',
  error: 'border-red-500/60',
}

export default function ToastStack() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className={clsx(
              'frosted pointer-events-auto flex w-full items-center gap-3 rounded-lg border bg-surface px-4 py-3 text-sm shadow-lg',
              KIND_STYLES[toast.kind] ?? KIND_STYLES.info,
            )}
          >
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              className="focus-ink text-muted hover:text-text"
              aria-label="Dismiss"
            >
              <Icon name="close" size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
