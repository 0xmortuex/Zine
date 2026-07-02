import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import Icon from './ui/Icon'
import { formatVolumeLabel } from '../lib/chapters'

/**
 * Collapsible volume group — a table-of-contents section divider on the
 * chapter spine rail.
 */
export default function VolumeSection({ volume, count, children }) {
  const [open, setOpen] = useState(true)

  return (
    <section className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="focus-ink group mb-1 flex w-full items-center gap-3 rounded py-2"
        aria-expanded={open}
      >
        <motion.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.18 }}
          className="text-muted group-hover:text-accent"
        >
          <Icon name="chevronDown" size={15} />
        </motion.span>
        <span className="text-[0.7rem] font-bold tracking-[0.22em] uppercase group-hover:text-accent">
          {formatVolumeLabel(volume)}
        </span>
        <span className="tnum text-[0.7rem] text-muted">{count}</span>
        <span className="rule-h flex-1" />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {/* Spine rail line */}
            <div className="relative ml-1.5 border-l border-border">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
