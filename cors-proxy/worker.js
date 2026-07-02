/**
 * Personal CORS proxy for the MangaDex API, deployable as a Cloudflare
 * Worker (free tier is far more than enough for one reader).
 *
 * Why: api.mangadex.org doesn't send CORS headers for third-party origins,
 * so browsers block direct calls from a hosted site. This worker forwards
 * requests server-side (no CORS there) and returns the response with
 * permissive CORS headers.
 *
 * Deploy (about 5 minutes, no CLI needed):
 *   1. https://dash.cloudflare.com → Workers & Pages → Create → Worker
 *   2. Name it (e.g. "zine-mangadex"), deploy the hello-world, then
 *      "Edit code", replace everything with this file, "Save and deploy".
 *   3. Copy the worker URL (https://zine-mangadex.<you>.workers.dev)
 *      into Zine: Settings → Content → API proxy.
 */

const UPSTREAM = 'https://api.mangadex.org'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
  'Access-Control-Max-Age': '86400',
}

export default {
  async fetch(request) {
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
        // MangaDex requires a meaningful User-Agent for non-browser clients.
        'User-Agent': 'Zine/1.0 (personal manga reader; cors worker)',
      },
    })

    const response = new Response(upstream.body, upstream)
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value)
    }
    return response
  },
}
