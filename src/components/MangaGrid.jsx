import { motion } from 'motion/react'
import MangaCard from './MangaCard'

/**
 * Staggered results grid. Only the first rows get a stagger delay so huge
 * result sets don't crawl in.
 */
export default function MangaGrid({ items }) {
  return (
    <motion.ul
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.035 } } }}
      className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      {items.map((manga, index) => (
        <motion.li
          key={manga.id}
          // Cap the stagger: items beyond the first screenful appear together.
          custom={index}
          variants={index < 15 ? undefined : { hidden: { opacity: 0 }, show: { opacity: 1 } }}
        >
          <MangaCard manga={manga} />
        </motion.li>
      ))}
    </motion.ul>
  )
}
