/**
 * Chapter page image preloader. Warms a sliding window of upcoming pages
 * with <img> prefetches and tracks status so the window can slide without
 * refetching. Page URL sets expire (~15 min on the at-home network), so
 * the reader checks isStale() before advancing and refetches transparently.
 */

export const PAGE_SET_TTL_MS = 12 * 60 * 1000

export function createPreloader(urls) {
  const status = new Map() // url -> 'loading' | 'done' | 'error'
  const waiters = new Map() // url -> [resolve...]
  const images = new Map() // url -> Image (kept for page-timing analysis)

  function warm(url) {
    if (!url || status.has(url)) return
    status.set(url, 'loading')
    const img = new Image()
    img.referrerPolicy = 'no-referrer'
    img.onload = () => settle(url, 'done')
    img.onerror = () => settle(url, 'error')
    img.src = url
    images.set(url, img)
  }

  function settle(url, result) {
    status.set(url, result)
    for (const resolve of waiters.get(url) ?? []) resolve(result)
    waiters.delete(url)
  }

  return {
    /** Warm [index-behind .. index+ahead], reading-direction agnostic. */
    warmAround(index, ahead = 3, behind = 1) {
      for (const i of preloadWindow(index, urls.length, ahead, behind)) warm(urls[i])
    },
    statusOf(url) {
      return status.get(url) ?? 'idle'
    },
    isReady(index) {
      return status.get(urls[index]) === 'done'
    },
    /** The (loaded or loading) Image element for a page, if warmed. */
    imageOf(index) {
      return images.get(urls[index]) ?? null
    },
    /** Resolves when the page at index finishes loading (or errored). */
    whenReady(index) {
      const url = urls[index]
      if (!url) return Promise.resolve('error')
      const current = status.get(url)
      if (current === 'done' || current === 'error') return Promise.resolve(current)
      if (!status.has(url)) warm(url)
      return new Promise((resolve) => {
        waiters.set(url, [...(waiters.get(url) ?? []), resolve])
      })
    },
  }
}

/** Pure window math — exported for the node check script. */
export function preloadWindow(index, length, ahead = 3, behind = 1) {
  const indices = []
  for (let i = Math.max(0, index - behind); i <= Math.min(length - 1, index + ahead); i++) {
    indices.push(i)
  }
  return indices
}

export function isStale(fetchedAt, now = Date.now()) {
  return now - fetchedAt > PAGE_SET_TTL_MS
}
