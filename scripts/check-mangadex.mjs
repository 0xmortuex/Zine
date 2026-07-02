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

console.log('\nall mangadex client checks passed')
