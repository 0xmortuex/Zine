/**
 * Hydration guards for the two persisted stores ('zine-settings' and
 * 'zine-library'). Pure — no React, no storage, no stores — and verified by
 * scripts/check-persisted-state.mjs against the shapes real visitors have.
 *
 * Why this exists: zustand's default hydration is a SHALLOW merge of the
 * saved blob over the defaults.
 *  - A nested group saved by an older build replaces the whole default
 *    group, so every key added since is undefined for that visitor
 *    (reader.smartTiming was "on by default" for nobody who had already
 *    changed a setting).
 *  - A value of the wrong type goes straight into state and the first
 *    component that touches it throws (history: null blanked the app).
 *
 * Rules:
 *  - A key that was never saved takes its default. That is a migration,
 *    not damage, and is not reported.
 *  - A saved value that is usable is kept exactly as it is.
 *  - A saved value that is unusable is replaced by its default (settings)
 *    or dropped (one library entry — never the whole section), and the
 *    affected area is named in `repaired` so the caller can tell the user.
 */

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isText = (value) => typeof value === 'string' && value.length > 0
const isCount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0

/* Validators return the value to keep (possibly clamped), or undefined. */
const oneOf =
  (...allowed) =>
  (value) =>
    allowed.includes(value) ? value : undefined
const flag = (value) => (typeof value === 'boolean' ? value : undefined)
const text = (value) => (typeof value === 'string' ? value : undefined)
const textList = (value) =>
  Array.isArray(value) && value.length > 0 && value.every(isText) ? value : undefined
const within = (min, max) => (value) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : undefined

function pick(source, key, fallback, validate, repaired, label) {
  if (source[key] === undefined) return fallback
  const value = validate(source[key])
  if (value !== undefined) return value
  repaired.push(label)
  return fallback
}

/** Merge one nested settings group key by key instead of wholesale. */
function pickGroup(source, key, defaults, spec, repaired, label) {
  if (source[key] === undefined) return defaults
  if (!isObject(source[key])) {
    repaired.push(label)
    return defaults
  }
  const group = {}
  for (const [field, validate] of Object.entries(spec)) {
    group[field] = pick(source[key], field, defaults[field], validate, repaired, `${label} ${field}`)
  }
  return group
}

/**
 * @param {unknown} persisted the saved `state` object (may be anything)
 * @param {object} current the store's defaults + actions
 * @param {string[]} themeIds valid theme ids
 * @returns {{ state: object, repaired: string[] }}
 */
export function mergeSettings(persisted, current, themeIds) {
  const repaired = []
  if (persisted == null) return { state: current, repaired }
  if (!isObject(persisted)) return { state: current, repaired: ['all settings'] }

  const state = {
    ...current,
    theme: pick(persisted, 'theme', current.theme, oneOf(...themeIds), repaired, 'theme'),
    layout: pick(persisted, 'layout', current.layout, oneOf('auto', 'mobile', 'desktop'), repaired, 'layout'),
    background: pickGroup(
      persisted,
      'background',
      current.background,
      { enabled: flag, blur: within(0, 24), dim: within(0, 0.9), fit: oneOf('cover', 'contain') },
      repaired,
      'background',
    ),
    reader: pickGroup(
      persisted,
      'reader',
      current.reader,
      {
        mode: oneOf('paged', 'vertical'),
        fit: oneOf('height', 'width', 'original', 'cover', 'spread'),
        direction: oneOf('rtl', 'ltr'),
        dataSaver: flag,
        preloadCount: within(1, 8),
        autoplayInterval: within(1, 60),
        smartTiming: flag,
        autoScrollSpeed: within(40, 400),
        tapToPause: flag,
      },
      repaired,
      'reader',
    ),
    languages: pick(persisted, 'languages', current.languages, textList, repaired, 'chapter language'),
    contentRatings: pick(persisted, 'contentRatings', current.contentRatings, textList, repaired, 'content ratings'),
    readableOnly: pick(persisted, 'readableOnly', current.readableOnly, flag, repaired, 'readable-only filter'),
    apiProxy: pick(persisted, 'apiProxy', current.apiProxy, text, repaired, 'API proxy'),
  }
  return { state, repaired }
}

/* ------------------------------- library -------------------------------
 * Entry cleaners return the SAME object when it is valid, a corrected copy
 * when a secondary field was off, or null when the entry cannot be used. */

function cleanFavorite(entry) {
  if (!isObject(entry) || !isObject(entry.manga) || !isText(entry.manga.id)) return null
  return isCount(entry.addedAt) ? entry : { ...entry, addedAt: 0 }
}

function cleanProgress(entry) {
  if (!isObject(entry) || !isText(entry.chapterId)) return null
  if (
    isCount(entry.page) &&
    isCount(entry.totalPages) &&
    typeof entry.chapterLabel === 'string' &&
    isCount(entry.updatedAt)
  ) {
    return entry
  }
  return {
    ...entry,
    page: isCount(entry.page) ? entry.page : 0,
    totalPages: isCount(entry.totalPages) ? entry.totalPages : 0,
    chapterLabel: typeof entry.chapterLabel === 'string' ? entry.chapterLabel : '',
    updatedAt: isCount(entry.updatedAt) ? entry.updatedAt : 0,
  }
}

function cleanReadMarks(entry) {
  if (!isObject(entry)) return null
  if (Object.values(entry).every((mark) => mark === true)) return entry
  const marks = {}
  for (const [chapterId, mark] of Object.entries(entry)) {
    if (mark) marks[chapterId] = true
  }
  return marks
}

function cleanHistoryEntry(entry) {
  if (!isObject(entry) || !isText(entry.mangaId) || !isText(entry.chapterId)) return null
  if (typeof entry.title === 'string' && typeof entry.chapterLabel === 'string' && isCount(entry.at)) {
    return entry
  }
  return {
    ...entry,
    title: typeof entry.title === 'string' ? entry.title : '',
    chapterLabel: typeof entry.chapterLabel === 'string' ? entry.chapterLabel : '',
    at: isCount(entry.at) ? entry.at : 0,
  }
}

function cleanMap(value, fallback, cleanEntry, repaired, label) {
  if (value === undefined) return fallback
  if (!isObject(value)) {
    repaired.push(label)
    return fallback
  }
  let damaged = false
  const result = {}
  for (const [key, entry] of Object.entries(value)) {
    const cleaned = cleanEntry(entry)
    if (cleaned !== entry) damaged = true
    if (cleaned !== null) result[key] = cleaned
  }
  if (!damaged) return value
  repaired.push(label)
  return result
}

function cleanList(value, fallback, cleanEntry, repaired, label) {
  if (value === undefined) return fallback
  if (!Array.isArray(value)) {
    repaired.push(label)
    return fallback
  }
  let damaged = false
  const result = []
  for (const entry of value) {
    const cleaned = cleanEntry(entry)
    if (cleaned !== entry) damaged = true
    if (cleaned !== null) result.push(cleaned)
  }
  if (!damaged) return value
  repaired.push(label)
  return result
}

/**
 * @param {unknown} persisted the saved `state` object (may be anything)
 * @param {object} current the store's defaults + actions
 * @returns {{ state: object, repaired: string[] }}
 */
export function mergeLibrary(persisted, current) {
  const repaired = []
  if (persisted == null) return { state: current, repaired }
  if (!isObject(persisted)) return { state: current, repaired: ['the whole library'] }

  const state = {
    ...current,
    favorites: cleanMap(persisted.favorites, current.favorites, cleanFavorite, repaired, 'favorites'),
    progress: cleanMap(persisted.progress, current.progress, cleanProgress, repaired, 'reading progress'),
    readChapters: cleanMap(persisted.readChapters, current.readChapters, cleanReadMarks, repaired, 'read marks'),
    history: cleanList(persisted.history, current.history, cleanHistoryEntry, repaired, 'history'),
  }
  return { state, repaired }
}

/**
 * The sentence shown to the user when something had to be repaired.
 * @param {'settings' | 'library'} kind
 * @param {string[]} repaired labels from mergeSettings / mergeLibrary
 */
export function describeRepair(kind, repaired) {
  const areas = [...new Set(repaired)].join(', ')
  return kind === 'settings'
    ? `Some saved settings were unreadable and are back on their defaults: ${areas}.`
    : `Part of your saved library was unreadable and was left out: ${areas}.`
}

/** The sentence shown when a saved blob could not be parsed at all. */
export function describeUnreadable(kind) {
  return kind === 'settings'
    ? 'Your saved settings could not be read at all, so Zine is using its defaults.'
    : 'Your saved library could not be read at all, so Zine is starting with an empty one.'
}
