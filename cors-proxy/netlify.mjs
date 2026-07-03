/**
 * Personal MangaDex relay for Netlify Edge Functions (free tier):
 *   1. In any repo, save this as  netlify/edge-functions/mangadex.mjs  and add
 *      to netlify.toml:
 *        [[edge_functions]]
 *        function = "mangadex"
 *        path = "/*"
 *   2. Deploy the repo on netlify.com
 *   3. Copy https://<site>.netlify.app into Zine: Settings → Content → API proxy
 */
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
  const upstream = await fetch(`${UPSTREAM}${url.pathname}${url.search}`, {
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
