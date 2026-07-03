/**
 * Comick source (api.comick.fun) — a second, independent online source so
 * the reader isn't captive to one API's availability. Uses the same
 * CORS-resilient fetch pipeline as MangaDex; ids are prefixed "ck:" so the
 * API router (./index.js) can dispatch by owner.
 *
 * Endpoints (community-documented, as used by open-source readers):
 *   GET /v1.0/search?q=&limit=&page=&tachiyomi=true
 *   GET /comic/{hid}?tachiyomi=true
 *   GET /comic/{hid}/chapters?lang=&limit=&page=
 *   GET /chapter/{hid}?tachiyomi=true
 * Images live on https://meo.comick.pictures/{b2key}.
 */
import { fetchJsonResilient, MangaDexError } from './corsFetch.js'

const API_BASE = 'https://api.comick.fun'
const IMG_BASE = 'https://meo.comick.pictures'

export const COMICK_PREFIX = 'ck:'
export const isComickId = (id) => typeof id === 'string' && id.startsWith(COMICK_PREFIX)
const hidOf = (id) => id.slice(COMICK_PREFIX.length)

const responseCache = new Map()

async function request(pathAndQuery, ttlMs = 10 * 60_000) {
  const cached = responseCache.get(pathAndQuery)
  if (cached && cached.expires > Date.now()) return cached.body
  const { status, body, statusText } = await fetchJsonResilient(`${API_BASE}${pathAndQuery}`)
  if (status === 429) {
    throw new MangaDexError('Rate limited by Comick — slow down and retry shortly', { status })
  }
  if (!body || status >= 400) {
    throw new MangaDexError(`Comick request failed: ${statusText || status}`, { status })
  }
  if (ttlMs > 0) responseCache.set(pathAndQuery, { body, expires: Date.now() + ttlMs })
  return body
}

const STATUS = { 1: 'ongoing', 2: 'completed', 3: 'cancelled', 4: 'hiatus' }

function coverFrom(entry) {
  const key = entry?.md_covers?.[0]?.b2key ?? entry?.cover_url ?? null
  if (!key) return null
  return key.startsWith('http') ? key : `${IMG_BASE}/${key}`
}

function normalizeComic(entry) {
  const cover = coverFrom(entry)
  return {
    id: `${COMICK_PREFIX}${entry.hid}`,
    title: entry.title ?? 'Untitled',
    altTitles: (entry.md_titles ?? []).map((t) => t.title).filter(Boolean).slice(0, 2),
    description: entry.desc ?? entry.parsed ?? '',
    status: STATUS[entry.status] ?? null,
    year: entry.year ?? null,
    contentRating: entry.content_rating ?? null,
    tags: (entry.md_comic_md_genres ?? []).map((g) => g?.md_genres?.name).filter(Boolean),
    availableLanguages: [],
    coverUrl: cover,
    coverThumbUrl: cover,
    source: 'comick',
  }
}

function normalizeChapter(ch) {
  return {
    id: `${COMICK_PREFIX}${ch.hid}`,
    volume: ch.vol ?? null,
    chapter: ch.chap ?? null,
    title: ch.title ?? '',
    translatedLanguage: ch.lang ?? 'en',
    pages: null, // page count only known once the chapter is opened
    publishAt: ch.created_at ?? new Date(0).toISOString(),
    externalUrl: null,
    scanlationGroup: Array.isArray(ch.group_name) ? ch.group_name[0] : (ch.group_name ?? null),
  }
}

export async function searchComick(title, { limit = 20, page = 1 } = {}) {
  const body = await request(
    `/v1.0/search?q=${encodeURIComponent(title)}&limit=${limit}&page=${page}&tachiyomi=true`,
  )
  const list = Array.isArray(body) ? body : []
  return { items: list.map(normalizeComic), total: list.length, limit, offset: (page - 1) * limit }
}

export async function getComickManga(mangaId) {
  const body = await request(`/comic/${hidOf(mangaId)}?tachiyomi=true`, 6 * 60 * 60_000)
  const comic = body?.comic ?? body
  if (!comic?.hid) throw new MangaDexError('Comick: comic not found', { status: 404 })
  return normalizeComic(comic)
}

export async function getComickChaptersAll(mangaId, { languages = ['en'] } = {}, onProgress) {
  const hid = hidOf(mangaId)
  const lang = languages[0] ?? 'en'
  const items = []
  let page = 1
  let total = Infinity
  while (items.length < total && page <= 50) {
    if (page > 1) await new Promise((resolve) => setTimeout(resolve, 250))
    const body = await request(
      `/comic/${hid}/chapters?lang=${encodeURIComponent(lang)}&limit=100&page=${page}`,
      30 * 60_000,
    )
    const batch = (body?.chapters ?? []).map(normalizeChapter)
    items.push(...batch)
    total = body?.total ?? items.length
    if (batch.length === 0) break
    page++
    onProgress?.(Math.min(items.length, total), total)
  }
  return items
}

/**
 * Comick's trending/rank lists — fallback for the homepage rails when
 * MangaDex is unreachable. Entries may carry hid or only a slug; the
 * comic endpoints accept either.
 */
export async function getComickTop() {
  const body = await request('/top?type=trending&comic_types=manga&accept_mature_content=false', 30 * 60_000)
  const normalizeTop = (list) =>
    (list ?? [])
      .filter((entry) => entry && (entry.hid || entry.slug) && entry.title)
      .map((entry) => normalizeComic({ ...entry, hid: entry.hid ?? entry.slug }))
  return {
    trending: normalizeTop(body?.trending?.[7] ?? body?.trending?.[30]),
    popular: normalizeTop(body?.rank),
  }
}

export async function getComickChapter(chapterId) {
  const body = await request(`/chapter/${hidOf(chapterId)}?tachiyomi=true`, 6 * 60 * 60_000)
  const ch = body?.chapter ?? body
  if (!ch?.hid) throw new MangaDexError('Comick: chapter not found', { status: 404 })
  const comicHid = ch.md_comics?.hid ?? body?.comic?.hid ?? ch.comic?.hid ?? null
  return {
    ...normalizeChapter(ch),
    pages: ch.md_images?.length ?? null,
    mangaId: comicHid ? `${COMICK_PREFIX}${comicHid}` : null,
  }
}

export async function getComickChapterPages(chapterId) {
  const body = await request(`/chapter/${hidOf(chapterId)}?tachiyomi=true`, 0)
  const images = body?.chapter?.md_images ?? []
  if (images.length === 0) {
    throw new MangaDexError('Comick: no pages in this chapter', { status: 404 })
  }
  return images.map((img) => `${IMG_BASE}/${img.b2key}`)
}
