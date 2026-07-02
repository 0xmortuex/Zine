import { motion } from 'motion/react'
import clsx from 'clsx'
import Icon from './Icon'

export default function IconButton({
  icon,
  label,
  size = 20,
  active = false,
  filled = false,
  className,
  ...props
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      aria-label={label}
      title={label}
      className={clsx(
        'focus-ink inline-flex items-center justify-center rounded-full p-2',
        active ? 'text-accent' : 'text-muted hover:text-text',
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={size} filled={filled} />
    </motion.button>
  )
}
