import { motion } from 'motion/react'
import clsx from 'clsx'

export default function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'focus-ink relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-40',
        checked ? 'border-accent bg-accent/90' : 'border-border bg-surface-raised',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 32 }}
        className={clsx(
          'absolute top-0.5 block h-[18px] w-[18px] rounded-full',
          checked ? 'right-0.5 bg-accent-fg' : 'left-0.5 bg-muted',
        )}
      />
    </button>
  )
}
