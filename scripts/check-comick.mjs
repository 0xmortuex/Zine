// Mocked-fetch checks for the Comick source: normalization, id routing,
// chapter pagination. Run: node scripts/check-comick.mjs
import assert from 'node:assert/strict'

const calls = []
globalThis.fetch = async (url) => {
  calls.push(new URL(url))
  const { pathname, searchParams } = new URL(url)

  if (pathname === '/v1.0/search') {
    return Response.json([
      {
        hid: 'AbC123',
        title: 'Static Bloom',
        desc: 'A test comic.',
        status: 2,
        year: 2019,
        content_rating: 'safe',
        md_covers: [{ b2key: 'cover-key.jpg' }],
      },
    ])
  }
  if (pathname === '/comic/AbC123/chapters') {
    const page = Number(searchParams.get('page'))
    const chapters =
      page === 1
        ? Array.from({ length: 100 }, (_, i) => ({
            hid: `chap-${i + 1}`,
            chap: String(i + 1),
            lang: 'en',
            created_at: '2021-01-01T00:00:00Z',
            group_name: ['Test Group'],
          }))
        : [{ hid: 'chap-101', chap: '101', lang: 'en', created_at: '2021-06-01T00:00:00Z', group_name: null }]
    return Response.json({ chapters, total: 101 })
  }
  if (pathname === '/comic/AbC123') {
    return Response.json({ comic: { hid: 'AbC123', title: 'Static Bloom', status: 2 } })
  }
  if (pathname === '/chapter/chap-1') {
    return Response.json({
      chapter: {
        hid: 'chap-1',
        chap: '1',
        lang: 'en',
        md_images: [{ b2key: 'p1.png' }, { b2key: 'p2.png' }],
        md_comics: { hid: 'AbC123' },
      },
    })
  }
  throw new Error(`unexpected fetch: ${url}`)
}

const {
  searchComick,
  getComickManga,
  getComickChaptersAll,
  getComickChapter,
  getComickChapterPages,
  isComickId,
} = await import('../src/api/comick.js')

// --- search normalization ---
const search = await searchComick('static bloom')
assert.equal(search.items.length, 1)
const manga = search.items[0]
assert.equal(manga.id, 'ck:AbC123')
assert.ok(isComickId(manga.id))
assert.equal(manga.status, 'completed')
assert.equal(manga.coverThumbUrl, 'https://meo.comick.pictures/cover-key.jpg')
assert.equal(manga.source, 'comick')
console.log('searchComick ok')

// --- detail ---
const detail = await getComickManga('ck:AbC123')
assert.equal(detail.id, 'ck:AbC123')
console.log('getComickManga ok')

// --- chapter pagination across pages ---
const progress = []
const chapters = await getComickChaptersAll('ck:AbC123', { languages: ['en'] }, (l, t) =>
  progress.push([l, t]),
)
assert.equal(chapters.length, 101)
assert.equal(chapters[0].id, 'ck:chap-1')
assert.equal(chapters[0].scanlationGroup, 'Test Group')
assert.equal(chapters.at(-1).chapter, '101')
assert.deepEqual(progress.at(-1), [101, 101])
const chapterCalls = calls.filter((u) => u.pathname.endsWith('/chapters'))
assert.deepEqual(chapterCalls.map((u) => u.searchParams.get('page')), ['1', '2'])
console.log('getComickChaptersAll pagination ok')

// --- deep link + pages ---
const chapter = await getComickChapter('ck:chap-1')
assert.equal(chapter.mangaId, 'ck:AbC123')
assert.equal(chapter.pages, 2)
const pages = await getComickChapterPages('ck:chap-1')
assert.deepEqual(pages, [
  'https://meo.comick.pictures/p1.png',
  'https://meo.comick.pictures/p2.png',
])
console.log('getComickChapter + pages ok')

console.log('\nall comick checks passed')
