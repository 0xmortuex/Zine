// Mocked-fetch checks for the MangaDex client: pagination loop, params,
// normalization. Run: node scripts/check-mangadex.mjs
import assert from 'node:assert/strict'

const calls = []
const TOTAL = 1200

function feedItem(i) {
  return {
    id: `ch-${i}`,
    type: 'chapter',
    attributes: {
      volume: '1',
      chapter: String(i + 1),
      title: null,
      translatedLanguage: 'en',
      pages: 10,
      publishAt: '2020-01-01T00:00:00+00:00',
      externalUrl: null,
    },
    relationships: [],
  }
}

globalThis.fetch = async (url) => {
  calls.push(new URL(url))
  const { pathname, searchParams } = new URL(url)
  if (pathname.endsWith('/feed')) {
    const offset = Number(searchParams.get('offset') ?? 0)
    const limit = Number(searchParams.get('limit') ?? 100)
    const data = Array.from(
      { length: Math.max(0, Math.min(limit, TOTAL - offset)) },
      (_, i) => feedItem(offset + i),
    )
    return new Response(
      JSON.stringify({ result: 'ok', data, total: TOTAL, limit, offset }),
      { status: 200 },
    )
  }
  if (pathname.startsWith('/chapter/')) {
    return new Response(
      JSON.stringify({
        result: 'ok',
        data: {
          ...feedItem(0),
          relationships: [{ id: 'manga-xyz', type: 'manga' }],
        },
      }),
      { status: 200 },
    )
  }
  throw new Error(`unexpected fetch: ${url}`)
}

const { getChaptersAll, getChapter, searchManga, __resetApiState } = await import(
  '../src/api/mangadex.js'
)

// --- pagination loop ---
const progress = []
const items = await getChaptersAll('manga-1', { languages: ['en'] }, (loaded, total) =>
  progress.push([loaded, total]),
)
assert.equal(items.length, TOTAL)
assert.equal(items[0].id, 'ch-0')
assert.equal(items.at(-1).id, `ch-${TOTAL - 1}`)

const feedCalls = calls.filter((u) => u.pathname.endsWith('/feed'))
assert.equal(feedCalls.length, 3) // 1200 items at limit 500 → offsets 0/500/1000
assert.deepEqual(
  feedCalls.map((u) => Number(u.searchParams.get('offset'))),
  [0, 500, 1000],
)
assert.ok(feedCalls.every((u) => Number(u.searchParams.get('limit')) === 500))
assert.deepEqual(progress, [
  [500, TOTAL],
  [1000, TOTAL],
  [1200, TOTAL],
])
console.log('getChaptersAll pagination ok')

// --- deep-link chapter fallback resolves manga id ---
const chapter = await getChapter('ch-0')
assert.equal(chapter.mangaId, 'manga-xyz')
console.log('getChapter ok')

// --- search: readable-only filter passes availableTranslatedLanguage[] ---
{
  const searchCalls = []
  globalThis.fetch = async (url) => {
    searchCalls.push(new URL(url))
    return new Response(
      JSON.stringify({ result: 'ok', data: [], total: 0, limit: 20, offset: 0 }),
      { status: 200 },
    )
  }
  await searchManga('jujutsu', { availableLanguages: ['en'] })
  assert.deepEqual(searchCalls[0].searchParams.getAll('availableTranslatedLanguage[]'), ['en'])
  await searchManga('jujutsu unfiltered')
  assert.deepEqual(searchCalls[1].searchParams.getAll('availableTranslatedLanguage[]'), [])
  console.log('readable-only search filter ok')
}

// --- CORS handling: relay race, cooldowns, caching (browser only) ---
{
  globalThis.window = {} // simulate a browser
  globalThis.localStorage = {
    store: {},
    getItem(key) {
      return this.store[key] ?? null
    },
  }

  const okBody = () =>
    new Response(JSON.stringify({ result: 'ok', data: { ...feedItem(0), relationships: [] } }), {
      status: 200,
    })
  const blockPage = (status = 403) =>
    new Response('<html>blocked — get an api key</html>', { status })
  const attempts = []
  const hosts = () => attempts.map((u) => new URL(u).host)

  // 1. Direct call returns garbage (Cloudflare challenge / captive portal)
  //    → falls through to the relay race, not surfaced as "Invalid JSON".
  __resetApiState()
  globalThis.fetch = async (url) => {
    attempts.push(url)
    if (url.startsWith('https://api.mangadex.org')) return blockPage(503)
    if (url.startsWith('https://api.allorigins.win/raw?url=')) return okBody()
    throw new TypeError('Failed to fetch')
  }
  assert.ok(await getChapter('c1'))
  assert.equal(hosts()[0], 'api.mangadex.org', 'direct attempt comes first')
  assert.ok(hosts().includes('api.allorigins.win'), 'relays raced')
  console.log('direct-garbage fallback ok')

  // 2. True CORS block is sticky: after it, requests go relay-first.
  __resetApiState()
  attempts.length = 0
  globalThis.fetch = async (url) => {
    attempts.push(url)
    if (url.startsWith('https://api.mangadex.org')) throw new TypeError('Failed to fetch')
    if (url.startsWith('https://api.allorigins.win/raw?url=')) return okBody()
    throw new TypeError('Failed to fetch')
  }
  assert.ok(await getChapter('c2'))
  attempts.length = 0
  assert.ok(await getChapter('c2b'))
  assert.deepEqual(hosts(), ['api.allorigins.win'], 'sticky block → remembered relay only')
  console.log('sticky CORS block + relay memory ok')

  // Primary relay: jina's envelope (shape verified against the live
  // service 2026-07) must unwrap into the upstream JSON, carrying the
  // real upstream HTTP status.
  __resetApiState()
  globalThis.fetch = async (url) => {
    if (url.startsWith('https://api.mangadex.org')) throw new TypeError('Failed to fetch')
    if (url.startsWith('https://r.jina.ai/')) {
      return Response.json({
        code: 200,
        status: 20000,
        meta: {},
        data: {
          title: '',
          description: '',
          url: 'https://api.mangadex.org/chapter/cj1',
          httpStatus: 200,
          content: JSON.stringify({
            result: 'ok',
            data: { ...feedItem(0), id: 'cj1', relationships: [{ id: 'm1', type: 'manga' }] },
          }),
          usage: {},
        },
      })
    }
    throw new TypeError('Failed to fetch')
  }
  const viaJina = await getChapter('cj1')
  assert.equal(viaJina.mangaId, 'm1')
  console.log('jina envelope unwrap ok')

  // 3. Remembered relay dies → re-race, another eligible relay takes over.
  __resetApiState()
  attempts.length = 0
  globalThis.fetch = async (url) => {
    attempts.push(url)
    if (url.startsWith('https://api.codetabs.com')) return okBody()
    throw new TypeError('Failed to fetch')
  }
  assert.ok(await getChapter('c3'))
  attempts.length = 0
  assert.ok(await getChapter('c3b'))
  assert.deepEqual(hosts(), ['api.codetabs.com'], 'failover winner remembered')
  console.log('relay failover ok')

  // 4. REGRESSION: a relay's own 4xx HTML block page is a relay failure,
  //    not an authoritative MangaDex answer — the race must continue.
  __resetApiState()
  globalThis.fetch = async (url) => {
    if (url.startsWith('https://api.mangadex.org')) throw new TypeError('Failed to fetch')
    if (url.startsWith('https://api.codetabs.com')) return blockPage(403)
    if (url.startsWith('https://corsproxy.io')) return blockPage(403)
    if (url.startsWith('https://api.allorigins.win/raw?url=')) return okBody()
    throw new TypeError('Failed to fetch')
  }
  assert.ok(await getChapter('c4'))
  console.log('relay block-page not authoritative ok')

  // 5. A real parsed MangaDex error through a relay is authoritative.
  __resetApiState()
  globalThis.fetch = async (url) => {
    if (url.startsWith('https://api.mangadex.org')) throw new TypeError('Failed to fetch')
    return new Response(
      JSON.stringify({ result: 'error', errors: [{ status: 404, detail: 'Chapter not found' }] }),
      { status: 404 },
    )
  }
  await assert.rejects(() => getChapter('c5'), /Chapter not found/)
  console.log('upstream error passthrough ok')

  // 6. Everything down → clear aggregated error, and the relays are benched:
  //    the immediate retry gets the cooling-down message without re-hammering.
  __resetApiState()
  attempts.length = 0
  globalThis.fetch = async (url) => {
    attempts.push(url)
    throw new TypeError('Failed to fetch')
  }
  await assert.rejects(() => getChapter('c6'), /public relay|API proxy/i)
  const attemptsAfterFirstFailure = attempts.length
  await assert.rejects(() => getChapter('c6'), /cooling down/i)
  assert.equal(attempts.length, attemptsAfterFirstFailure, 'cooldown must prevent re-hammering')
  console.log('all-down message + cooldown ok')

  // 7. Response cache: a repeated request never touches the network again.
  __resetApiState()
  attempts.length = 0
  globalThis.fetch = async (url) => {
    attempts.push(url)
    return okBody()
  }
  await getChapter('c7')
  await getChapter('c7')
  assert.equal(attempts.length, 1, 'second request must be served from cache')
  console.log('response cache ok')

  // 8. A user-configured proxy takes priority over everything.
  __resetApiState()
  globalThis.localStorage.store['zine-settings'] = JSON.stringify({
    state: { apiProxy: 'https://zine-mangadex.example.workers.dev/' },
  })
  attempts.length = 0
  globalThis.fetch = async (url) => {
    attempts.push(url)
    assert.ok(url.startsWith('https://zine-mangadex.example.workers.dev/chapter/c8'))
    return okBody()
  }
  await getChapter('c8')
  assert.equal(attempts.length, 1)
  console.log('user proxy priority ok')
}

console.log('\nall mangadex client checks passed')

