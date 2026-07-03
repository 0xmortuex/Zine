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

const { getChaptersAll, getChapter } = await import('../src/api/mangadex.js')

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

// --- CORS handling: relay race fallback on network error (browser only) ---
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
  const attempts = []

  // Direct CORS-fails → all relays race; only allorigins/raw answers.
  globalThis.fetch = async (url) => {
    attempts.push(url)
    if (url.startsWith('https://api.mangadex.org')) {
      throw new TypeError('Failed to fetch') // what a CORS block looks like
    }
    if (url.startsWith('https://api.allorigins.win/raw?url=')) return okBody()
    throw new TypeError('Failed to fetch') // every other relay is down
  }
  const viaRelay = await getChapter('ch-0')
  assert.equal(viaRelay.id, 'ch-0')
  const hosts = attempts.map((u) => new URL(u).host)
  assert.equal(hosts[0], 'api.mangadex.org', 'direct attempt comes first')
  assert.ok(hosts.includes('api.allorigins.win'), 'relays raced')
  assert.ok(
    decodeURIComponent(attempts.find((u) => u.includes('/raw?url='))).includes(
      'https://api.mangadex.org/chapter/ch-0',
    ),
    'relay URL should wrap the direct API URL',
  )
  console.log('relay race fallback ok')

  // Winner is remembered: next request goes straight to it, no direct, no race.
  attempts.length = 0
  await getChapter('ch-0')
  assert.deepEqual(
    attempts.map((u) => new URL(u).host),
    ['api.allorigins.win'],
    'winning relay should be remembered',
  )
  console.log('relay memory ok')

  // Winner dies → re-race, another relay takes over.
  attempts.length = 0
  globalThis.fetch = async (url) => {
    attempts.push(url)
    if (url.startsWith('https://api.codetabs.com')) return okBody()
    throw new TypeError('Failed to fetch')
  }
  const viaFailover = await getChapter('ch-0')
  assert.equal(viaFailover.id, 'ch-0')
  attempts.length = 0
  await getChapter('ch-0')
  assert.deepEqual(
    attempts.map((u) => new URL(u).host),
    ['api.codetabs.com'],
    'failover winner should be remembered',
  )
  console.log('relay failover ok')

  // A real API error through the remembered relay is authoritative.
  attempts.length = 0
  globalThis.fetch = async (url) => {
    attempts.push(url)
    return new Response(
      JSON.stringify({ result: 'error', errors: [{ status: 404, detail: 'Chapter not found' }] }),
      { status: 404 },
    )
  }
  await assert.rejects(() => getChapter('nope'), /Chapter not found/)
  assert.equal(attempts.length, 1, 'upstream 404 must not be retried across relays')
  console.log('upstream error passthrough ok')

  // Everything down → single clear, actionable error.
  attempts.length = 0
  globalThis.fetch = async (url) => {
    attempts.push(url)
    throw new TypeError('Failed to fetch')
  }
  await assert.rejects(() => getChapter('ch-0'), /public relay|API proxy/i)
  console.log('all-relays-down message ok')

  // --- user-configured proxy takes priority, no relay retry ---
  globalThis.localStorage.store['zine-settings'] = JSON.stringify({
    state: { apiProxy: 'https://zine-mangadex.example.workers.dev/' },
  })
  attempts.length = 0
  globalThis.fetch = async (url) => {
    attempts.push(url)
    assert.ok(url.startsWith('https://zine-mangadex.example.workers.dev/chapter/ch-0'))
    return new Response(
      JSON.stringify({ result: 'ok', data: { ...feedItem(0), relationships: [] } }),
      { status: 200 },
    )
  }
  await getChapter('ch-0')
  assert.equal(attempts.length, 1)
  console.log('user proxy priority ok')
}

console.log('\nall mangadex client checks passed')
