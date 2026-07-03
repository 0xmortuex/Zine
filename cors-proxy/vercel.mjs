/**
 * Personal MangaDex relay for Vercel (free Hobby tier):
 *   1. Make an empty repo containing just  api/[...path].mjs  with this file
 *   2. Import the repo at vercel.com → Deploy
 *   3. Copy https://<project>.vercel.app into Zine: Settings → Content → API proxy
 */
export const config = { runtime: 'edge' }

const UPSTREAM = 'https://api.mangadex.org'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
  'Access-Control-Max-Age': '86400',
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api/, '')
  const upstream = await fetch(`${UPSTREAM}${path}${url.search}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Zine/1.0 (personal manga reader; relay)',
    },
  })
  const response = new Response(upstream.body, upstream)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}
