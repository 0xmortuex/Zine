// Pure-function checks for src/lib/chapters.js.
// Run: node scripts/check-chapters-lib.mjs
import assert from 'node:assert/strict'
import {
  dedupeChapters,
  groupByVolume,
  findPrevNext,
  formatChapterLabel,
} from '../src/lib/chapters.js'

const ch = (id, chapter, opts = {}) => ({
  id,
  chapter,
  volume: 'volume' in opts ? opts.volume : '1',
  title: opts.title ?? '',
  pages: opts.pages ?? 10,
  publishAt: opts.publishAt ?? '2020-01-01T00:00:00Z',
  externalUrl: opts.externalUrl ?? null,
  scanlationGroup: opts.group ?? 'Group A',
})

// --- dedupe picks earliest publish as canonical ---
{
  const { entries } = dedupeChapters([
    ch('a', '1', { publishAt: '2020-02-01T00:00:00Z', group: 'Late Group' }),
    ch('b', '1', { publishAt: '2020-01-01T00:00:00Z', group: 'Early Group' }),
  ])
  assert.equal(entries.length, 1)
  assert.equal(entries[0].id, 'b')
  assert.equal(entries[0].versions.length, 2)
  console.log('dedupe: earliest-publish canonical ok')
}

// --- dedupe honors a previously-read version ---
{
  const { entries } = dedupeChapters(
    [
      ch('a', '1', { publishAt: '2020-02-01T00:00:00Z', group: 'Late Group' }),
      ch('b', '1', { publishAt: '2020-01-01T00:00:00Z', group: 'Early Group' }),
    ],
    { a: true },
  )
  assert.equal(entries[0].id, 'a')
  console.log('dedupe: previously-read group preferred ok')
}

// --- oneshots (null chapter) stay distinct, sort last ---
{
  const { entries } = dedupeChapters([
    ch('one-1', null, { volume: null, title: 'Oneshot A' }),
    ch('one-2', null, { volume: null, title: 'Oneshot B' }),
    ch('c2', '2'),
    ch('c1', '1'),
  ])
  assert.equal(entries.length, 4)
  assert.deepEqual(
    entries.map((e) => e.id).slice(0, 2),
    ['c1', 'c2'],
  )
  assert.ok(entries.slice(2).every((e) => e.chapter === null))
  console.log('dedupe: oneshots distinct + last ok')
}

// --- decimal chapter ordering ---
{
  const { entries } = dedupeChapters([ch('c10', '10'), ch('c9-5', '9.5'), ch('c9', '9')])
  assert.deepEqual(
    entries.map((e) => e.chapter),
    ['9', '9.5', '10'],
  )
  console.log('dedupe: numeric (decimal) ordering ok')
}

// --- external bucket ---
{
  const { entries, external } = dedupeChapters([
    ch('c1', '1'),
    ch('ext', '2', { pages: 0, externalUrl: 'https://example.com' }),
  ])
  assert.equal(entries.length, 1)
  assert.equal(external.length, 1)
  assert.equal(external[0].id, 'ext')
  console.log('dedupe: external bucket ok')
}

// --- volume grouping preserves order ---
{
  const { entries } = dedupeChapters([
    ch('c1', '1', { volume: '1' }),
    ch('c2', '2', { volume: '1' }),
    ch('c3', '3', { volume: '2' }),
    ch('nv', '4', { volume: null }),
    ch('os', null, { volume: null, title: 'Oneshot' }),
  ])
  const groups = groupByVolume(entries)
  assert.deepEqual(
    groups.map((g) => g.volume),
    ['1', '2', 'none', 'oneshots'],
  )
  assert.deepEqual(groups[0].chapters.map((c) => c.id), ['c1', 'c2'])
  console.log('groupByVolume ok')
}

// --- prev/next walks canonical order and matches version ids ---
{
  const { entries } = dedupeChapters([
    ch('c1', '1'),
    ch('c2-early', '2', { publishAt: '2020-01-01T00:00:00Z' }),
    ch('c2-late', '2', { publishAt: '2020-03-01T00:00:00Z', group: 'Other' }),
    ch('c3', '3'),
  ])
  // navigate by the NON-canonical version id — must still locate chapter 2
  const { prev, next, current } = findPrevNext(entries, 'c2-late')
  assert.equal(current.chapter, '2')
  assert.equal(prev.id, 'c1')
  assert.equal(next.id, 'c3')
  assert.deepEqual(findPrevNext(entries, 'c1').prev, null)
  assert.deepEqual(findPrevNext(entries, 'missing'), { prev: null, next: null, current: null })
  console.log('findPrevNext ok')
}

// --- labels ---
assert.equal(formatChapterLabel(ch('x', '12')), 'Ch. 12')
assert.equal(formatChapterLabel(ch('x', '12', { title: 'The Print Room' })), 'Ch. 12 — The Print Room')
assert.equal(formatChapterLabel(ch('x', null, { title: 'Oneshot A' })), 'Oneshot A')
console.log('formatChapterLabel ok')

console.log('\nall chapters-lib checks passed')
