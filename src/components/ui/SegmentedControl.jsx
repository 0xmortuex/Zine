import { motion } from 'motion/react'
import { useId } from 'react'
import clsx from 'clsx'

/**
 * Segmented option row with a sliding ink highlight (shared layoutId).
 */
export default function SegmentedControl({ options, value, onChange, label }) {
  const groupId = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-md border border-border bg-surface p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={clsx(
              'focus-ink relative rounded px-3 py-1.5 text-xs font-semibold tracking-wide',
              selected ? 'text-accent-fg' : 'text-muted hover:text-text',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`segment-${groupId}`}
                transition={{ type: 'spring', stiffness: 550, damping: 35 }}
                className="absolute inset-0 rounded bg-accent"
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
