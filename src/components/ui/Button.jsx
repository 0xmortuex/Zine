import { motion } from 'motion/react'
import clsx from 'clsx'

const VARIANTS = {
  primary: 'bg-accent text-accent-fg hover:brightness-110',
  surface: 'bg-surface-raised text-text border border-border hover:border-accent/60',
  ghost: 'text-muted hover:text-text hover:bg-surface-raised/60',
  danger: 'border border-red-500/40 text-red-400 hover:bg-red-500/10',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export default function Button({
  variant = 'surface',
  size = 'md',
  className,
  children,
  ...props
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={clsx(
        'focus-ink inline-flex items-center justify-center gap-2 rounded-md font-semibold tracking-wide disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  )
}
