/**
 * Pure chapter-list logic: dedupe multiple scanlations, volume grouping,
 * prev/next navigation. No React, no I/O — verified by scripts/check-chapters-lib.mjs.
 */

/** Grouping key: one entry per (volume, chapter number); oneshots stay distinct. */
export function chapterKey(chapter) {
  if (chapter.chapter == null) return `oneshot:${chapter.id}`
  return `${chapter.volume ?? ''}|${chapter.chapter}`
}

export function isExternal(chapter) {
  return Boolean(chapter.externalUrl) && (!chapter.pages || chapter.pages === 0)
}

const numeric = (value) => {
  const n = Number.parseFloat(value)
  return Number.isNaN(n) ? Infinity : n
}

/**
 * Collapse duplicate scanlations into one canonical entry per chapter.
 * Canonical pick: a version the user has already read (readChapterIds),
 * else the earliest published (usually the original group).
 *
 * Returns readable entries sorted by chapter number ascending (oneshots
 * last), each shaped { ...canonicalChapter, versions: [...] }, plus the
 * external-only bucket.
 */
export function dedupeChapters(chapters, readChapterIds = {}) {
  const external = chapters.filter(isExternal)
  const readable = chapters.filter((c) => !isExternal(c))

  const byKey = new Map()
  for (const chapter of readable) {
    const key = chapterKey(chapter)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(chapter)
  }

  const entries = []
  for (const versions of byKey.values()) {
    versions.sort((a, b) => new Date(a.publishAt) - new Date(b.publishAt))
    const canonical = versions.find((v) => readChapterIds[v.id]) ?? versions[0]
    entries.push({ ...canonical, versions })
  }

  entries.sort((a, b) => {
    const an = numeric(a.chapter)
    const bn = numeric(b.chapter)
    if (an !== bn) return an - bn
    return new Date(a.publishAt) - new Date(b.publishAt)
  })

  return { entries, external }
}

/** Group deduped entries by volume, preserving chapter order within groups. */
export function groupByVolume(entries) {
  const groups = []
  const index = new Map()
  for (const entry of entries) {
    const volume = entry.chapter == null ? 'oneshots' : (entry.volume ?? 'none')
    if (!index.has(volume)) {
      const group = { volume, chapters: [] }
      index.set(volume, group)
      groups.push(group)
    }
    index.get(volume).chapters.push(entry)
  }
  return groups
}

/**
 * Previous/next chapter around chapterId in the deduped reading order.
 * Matches the canonical id or any of its versions' ids.
 */
export function findPrevNext(entries, chapterId) {
  const at = entries.findIndex(
    (entry) => entry.id === chapterId || entry.versions?.some((v) => v.id === chapterId),
  )
  if (at === -1) return { prev: null, next: null, current: null }
  return {
    prev: entries[at - 1] ?? null,
    next: entries[at + 1] ?? null,
    current: entries[at],
  }
}

export function formatChapterLabel(chapter) {
  if (chapter.chapter == null) return chapter.title || 'Oneshot'
  const base = `Ch. ${chapter.chapter}`
  return chapter.title && chapter.title !== `Chapter ${chapter.chapter}`
    ? `${base} — ${chapter.title}`
    : base
}

export function formatVolumeLabel(volume) {
  if (volume === 'oneshots') return 'Oneshots'
  if (volume === 'none') return 'No volume'
  if (volume === 'external') return 'Hosted externally'
  return `Volume ${volume}`
}
