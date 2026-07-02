import { motion } from 'motion/react'

/** Standard route enter/exit: quick fade + rise, transform/opacity only. */
export default function PageTransition({ children, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
