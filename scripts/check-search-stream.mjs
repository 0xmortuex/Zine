// Checks for the streaming multi-source search merge.
// Run: node scripts/check-search-stream.mjs
import assert from 'node:assert/strict'
import { streamSearch, titleKey } from '../src/api/searchStream.js'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const manga = (title) => ({ title })

// --- fast source lands first, slow source appends; dedupe by title ---
{
  const batches = []
  const { partial } = await streamSearch(
    [
      async () => {
        await wait(80)
        return { items: [manga('Blue Lock'), manga('Blue Lock: Episode Nagi')], source: 'slow' }
      },
      async () => {
        await wait(5)
        return { items: [manga('BLUE LOCK'), manga('Ao Ashi')], source: 'fast' }
      },
    ],
    (items, meta) => batches.push({ titles: items.map((m) => m.title), source: meta.source }),
  )
  assert.equal(partial, false)
  assert.equal(batches[0].source, 'fast', 'fast source must arrive first')
  assert.deepEqual(batches[0].titles, ['BLUE LOCK', 'Ao Ashi'])
  // "Blue Lock" collapses into the fast source's entry; the sequel stays.
  assert.deepEqual(batches[1].titles, ['Blue Lock: Episode Nagi'])
  console.log('streaming order + title dedupe ok')
}

// --- one source failing → partial true, results still delivered ---
{
  const batches = []
  const { partial } = await streamSearch(
    [
      async () => {
        throw new Error('source down')
      },
      async () => ({ items: [manga('Jujutsu Kaisen')], source: 'ok' }),
    ],
    (items) => batches.push(items.length),
  )
  assert.equal(partial, true)
  assert.deepEqual(batches, [1])
  console.log('partial delivery ok')
}

// --- all sources failing → throws the first error ---
{
  await assert.rejects(
    () =>
      streamSearch(
        [
          async () => {
            throw new Error('first failure')
          },
          async () => {
            throw new Error('second failure')
          },
        ],
        () => {},
      ),
    /first failure/,
  )
  console.log('all-fail throws ok')
}

// --- a source with zero results still counts as delivered (no error) ---
{
  const { partial } = await streamSearch(
    [
      async () => ({ items: [], source: 'empty' }),
      async () => {
        throw new Error('down')
      },
    ],
    () => {},
  )
  assert.equal(partial, true)
  console.log('empty-but-alive source ok')
}

// --- titleKey normalization ---
assert.equal(titleKey('Blue Lock!!'), titleKey('BLUE  lock'))
assert.notEqual(titleKey('Blue Lock'), titleKey('Blue Lock: Episode Nagi'))
console.log('titleKey ok')

console.log('\nall search-stream checks passed')
