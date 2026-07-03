import { unzipSync } from 'fflate'
import { get, set, del } from 'idb-keyval'

/**
 * Local shelf: manga the user imports manually (.cbz/.zip chapter archives
 * or loose image files). Everything lives in IndexedDB — no network, no
 * relays, no server. Local ids are prefixed 'local:' so the API layer
 * (src/api/index.js) can route them here instead of MangaDex.
 */

const INDEX_KEY = 'zine:local:index'
const pagesKey = (chapterId) => `zine:local:pages:${chapterId}`

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
}

export const isLocalId = (id) => typeof id === 'string' && id.startsWith('local:')

/** Natural filename order: page2 < page10. */
export function sortPageNames(names) {
  return [...names].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  )
}

export function isImageEntry(name) {
  return IMAGE_EXT.test(name) && !name.split('/').pop().startsWith('.')
}

/** "Solo Max Ch. 12.cbz" → "Ch. 12" style label guess; falls back to stem. */
export function chapterTitleFromFilename(fileName) {
  const stem = fileName.replace(/\.[^.]+$/, '')
  const match = stem.match(/(?:ch(?:apter)?|c)[\s._-]*(\d+(?:\.\d+)?)/i)
  return match ? `Chapter ${match[1]}` : stem
}

/** Extract ordered page {name, bytes, mime} entries from a zip/cbz buffer. */
export function extractPagesFromZip(bytes) {
  const entries = unzipSync(bytes)
  const names = sortPageNames(Object.keys(entries).filter(isImageEntry))
  return names.map((name) => ({
    name,
    bytes: entries[name],
    mime: MIME_BY_EXT[name.split('.').pop().toLowerCase()] ?? 'image/jpeg',
  }))
}

/* ------------------------------ persistence ------------------------------ */

export async function listLocalManga() {
  return (await get(INDEX_KEY)) ?? []
}

export async function getLocalManga(id) {
  const index = await listLocalManga()
  return index.find((m) => m.id === id) ?? null
}

export async function findLocalChapter(chapterId) {
  const index = await listLocalManga()
  for (const manga of index) {
    const chapter = manga.chapters.find((c) => c.id === chapterId)
    if (chapter) return { manga, chapter }
  }
  return null
}

export async function getLocalChapterPageBlobs(chapterId) {
  return (await get(pagesKey(chapterId))) ?? []
}

async function saveIndex(index) {
  await set(INDEX_KEY, index)
}

/** Small stable thumbnail (data URI) so covers survive reloads everywhere. */
async function makeThumb(blob) {
  try {
    const bitmap = await createImageBitmap(blob)
    const scale = 256 / Math.max(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.75)
  } catch {
    return null
  }
}

const slug = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

/**
 * Import files into a local series (created if it doesn't exist yet).
 * Each .cbz/.zip file becomes one chapter; loose image files are grouped
 * into a single chapter. Returns the updated series entry.
 */
export async function importChapters(title, files, existingId = null) {
  const index = await listLocalManga()
  let manga = existingId ? index.find((m) => m.id === existingId) : null
  if (!manga) {
    manga = {
      id: `local:${slug(title) || 'series'}-${Date.now().toString(36)}`,
      title: title.trim() || 'Untitled',
      thumb: null,
      chapters: [],
      addedAt: Date.now(),
    }
    index.unshift(manga)
  }

  const archives = []
  const looseImages = []
  for (const file of files) {
    if (/\.(cbz|zip)$/i.test(file.name)) archives.push(file)
    else if (isImageEntry(file.name)) looseImages.push(file)
  }

  const newChapters = []
  for (const archive of archives) {
    const bytes = new Uint8Array(await archive.arrayBuffer())
    const pages = extractPagesFromZip(bytes)
    if (pages.length === 0) continue
    newChapters.push({
      fileName: archive.name,
      blobs: pages.map((p) => new Blob([p.bytes], { type: p.mime })),
    })
  }
  if (looseImages.length > 0) {
    const ordered = sortPageNames(looseImages.map((f) => f.name)).map((name) =>
      looseImages.find((f) => f.name === name),
    )
    newChapters.push({ fileName: 'Imported pages', blobs: ordered })
  }

  let nextNumber = manga.chapters.length + 1
  for (const { fileName, blobs } of newChapters) {
    const chapterId = `local:ch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    await set(pagesKey(chapterId), blobs)
    manga.chapters.push({
      id: chapterId,
      chapter: String(nextNumber++),
      title: chapterTitleFromFilename(fileName),
      pages: blobs.length,
      addedAt: Date.now(),
    })
    if (!manga.thumb) manga.thumb = await makeThumb(blobs[0])
  }

  await saveIndex(index)
  return manga
}

export async function deleteLocalManga(id) {
  const index = await listLocalManga()
  const manga = index.find((m) => m.id === id)
  if (!manga) return
  for (const chapter of manga.chapters) {
    await del(pagesKey(chapter.id))
  }
  await saveIndex(index.filter((m) => m.id !== id))
}

/* --------------------- normalization to the API shapes -------------------- */

export function normalizeLocalManga(entry) {
  return {
    id: entry.id,
    title: entry.title,
    altTitles: [],
    description: `Imported to this device — ${entry.chapters.length} chapter${entry.chapters.length === 1 ? '' : 's'}, stored locally in your browser. Reads fully offline.`,
    status: 'on device',
    year: null,
    contentRating: null,
    tags: ['Local import'],
    availableLanguages: [],
    coverUrl: entry.thumb,
    coverThumbUrl: entry.thumb,
    isLocal: true,
  }
}

export function normalizeLocalChapter(chapter) {
  return {
    id: chapter.id,
    volume: null,
    chapter: chapter.chapter,
    title: chapter.title,
    translatedLanguage: 'local',
    pages: chapter.pages,
    publishAt: new Date(chapter.addedAt).toISOString(),
    externalUrl: null,
    scanlationGroup: 'On device',
  }
}
