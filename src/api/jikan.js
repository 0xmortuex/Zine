/**
 * Jikan (api.jikan.moe — MyAnimeList data): a genuinely CORS-open, no-key
 * public API. It has no chapter content, so it powers DISCOVERY only: the
 * homepage rails fall back to it when neither reading source is reachable.
 * Cards from here carry source "mal" and ids "mal:<id>"; tapping one hands
 * off to a title search across the readable sources.
 */
import { fetchJsonResilient, MangaDexError } from './corsFetch.js'

const API_BASE = 'https://api.jikan.moe/v4'

const STATUS = {
  Publishing: 'ongoing',
  Finished: 'completed',
  'On Hiatus': 'hiatus',
  Discontinued: 'cancelled',
}

function normalize(entry) {
  const cover = entry.images?.jpg?.image_url ?? entry.images?.webp?.image_url ?? null
  return {
    id: `mal:${entry.mal_id}`,
    title: entry.title ?? 'Untitled',
    altTitles: [],
    description: entry.synopsis ?? '',
    status: STATUS[entry.status] ?? null,
    year: entry.published?.prop?.from?.year ?? null,
    contentRating: null,
    tags: (entry.genres ?? []).slice(0, 4).map((g) => g.name),
    availableLanguages: [],
    coverUrl: cover,
    coverThumbUrl: cover,
    source: 'mal',
  }
}

async function top(filter, limit) {
  const query = filter ? `&filter=${filter}` : ''
  const { status, body } = await fetchJsonResilient(
    `${API_BASE}/top/manga?limit=${limit}${query}`,
  )
  if (!body?.data || status >= 400) {
    throw new MangaDexError(`Jikan request failed: ${status}`, { status })
  }
  return body.data.map(normalize)
}

/** Currently-publishing top titles — the "trending" flavor. */
export function getJikanTrending(limit = 12) {
  return top('publishing', limit)
}

/** All-time most popular (by MAL members). */
export function getJikanPopular(limit = 12) {
  return top('bypopularity', limit)
}
