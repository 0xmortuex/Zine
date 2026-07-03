/**
 * Streaming multi-source search: every source pushes its results the
 * moment it answers — the UI never waits for the slowest (or a dead)
 * source. Cross-source duplicates are collapsed by normalized title,
 * first-arrival wins. Throws only when EVERY source failed and nothing
 * was delivered.
 */

export const titleKey = (title) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * @param {Array<() => Promise<{items: Array, total?: number, source?: string}>>} sourceThunks
 * @param {(freshItems: Array, meta: {total?: number, source?: string}) => void} onBatch
 * @returns {Promise<{partial: boolean}>} partial = at least one source failed
 */
export async function streamSearch(sourceThunks, onBatch) {
  const seen = new Set()
  let delivered = false
  let firstError = null

  await Promise.allSettled(
    sourceThunks.map(async (thunk) => {
      try {
        const result = await thunk()
        const fresh = (result.items ?? []).filter((manga) => {
          const key = titleKey(manga.title)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        delivered = true
        if (fresh.length > 0) onBatch(fresh, result)
      } catch (err) {
        firstError = firstError ?? err
      }
    }),
  )

  if (!delivered && firstError) throw firstError
  return { partial: firstError != null }
}
