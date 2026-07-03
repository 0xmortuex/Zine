/**
 * Personal MangaDex relay for Deno Deploy (free, no CLI):
 *   1. https://dash.deno.com → New Playground
 *   2. Paste this file, hit Save & Deploy
 *   3. Copy the *.deno.dev URL into Zine: Settings → Content → API proxy
 */
const UPSTREAM = 'https://api.mangadex.org'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (request: Request) => {
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
})
