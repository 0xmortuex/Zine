// Checks for the library store (favorites, progress, read marks, history).
// Run: node scripts/check-library-store.mjs
import assert from 'node:assert/strict'

// The store persists through window.localStorage; give it an in-memory one.
const storage = new Map()
globalThis.window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
}

const { useLibrary } = await import('../src/store/useLibrary.js')
const state = () => useLibrary.getState()

// --- markRead is a true no-op when nothing changes ---
{
  let notifications = 0
  const unsubscribe = useLibrary.subscribe(() => notifications++)

  state().markRead('m1', 'c1')
  assert.equal(notifications, 1)
  assert.deepEqual(state().readChapters, { m1: { c1: true } })

  const before = state()
  state().markRead('m1', 'c1') // same mark again
  assert.equal(notifications, 1, 'repeating a mark must not notify subscribers')
  assert.equal(state(), before, 'repeating a mark must keep the same state object')
  assert.equal(state().readChapters, before.readChapters)

  state().markRead('m1', 'never-read', false) // un-marking something unread
  assert.equal(notifications, 1, 'un-marking an unread chapter must not notify')

  state().markRead('m1', 'c1', false)
  assert.equal(notifications, 2)
  assert.deepEqual(state().readChapters, { m1: {} })
  unsubscribe()
  console.log('markRead: no-op writes do not notify ok')
}

// --- REGRESSION: the reader's end-of-chapter loop ---
// The reader marks the chapter read on its last page, and re-derives its
// chapter list whenever readChapters changes. If a repeated markRead looked
// like a change, that derive -> mark -> derive cycle never ended and React
// tore the whole app down ("Maximum update depth exceeded").
{
  let rounds = 0
  let seen = state().readChapters
  const unsubscribe = useLibrary.subscribe((next) => {
    if (next.readChapters === seen) return
    seen = next.readChapters
    rounds++
    assert.ok(rounds < 20, 'markRead must settle instead of re-triggering itself')
    next.markRead('m2', 'last-page-chapter')
  })
  state().markRead('m2', 'last-page-chapter')
  unsubscribe()
  assert.equal(rounds, 1, 'one change, then the repeat is a no-op')
  console.log('markRead: derive -> mark cycle settles ok')
}

// --- progress: one slot per manga, stamped ---
{
  state().setProgress('m1', { chapterId: 'c1', chapterLabel: 'Ch. 1', page: 3, totalPages: 20 })
  const saved = state().progress.m1
  assert.equal(saved.chapterId, 'c1')
  assert.equal(saved.page, 3)
  assert.equal(typeof saved.updatedAt, 'number')
  state().setProgress('m1', { chapterId: 'c2', chapterLabel: 'Ch. 2', page: 0, totalPages: 18 })
  assert.equal(state().progress.m1.chapterId, 'c2')
  state().removeProgress('m1')
  assert.equal(state().progress.m1, undefined)
  console.log('progress ok')
}

// --- favorites toggle keeps a manga snapshot ---
{
  const manga = { id: 'm1', title: 'Paper Lanterns', coverThumbUrl: null }
  state().toggleFavorite(manga)
  assert.equal(state().isFavorite('m1'), true)
  assert.deepEqual(state().favorites.m1.manga, manga)
  state().toggleFavorite(manga)
  assert.equal(state().isFavorite('m1'), false)
  console.log('favorites ok')
}

// --- history: newest first, one row per manga, capped at 50 ---
{
  state().clearHistory()
  state().pushHistory({ mangaId: 'a', title: 'A', chapterId: 'a1', chapterLabel: 'Ch. 1' })
  state().pushHistory({ mangaId: 'b', title: 'B', chapterId: 'b1', chapterLabel: 'Ch. 1' })
  state().pushHistory({ mangaId: 'a', title: 'A', chapterId: 'a2', chapterLabel: 'Ch. 2' })
  assert.deepEqual(
    state().history.map((h) => `${h.mangaId}:${h.chapterId}`),
    ['a:a2', 'b:b1'],
  )
  for (let i = 0; i < 60; i++) {
    state().pushHistory({ mangaId: `bulk-${i}`, title: 'x', chapterId: 'c', chapterLabel: 'Ch. 1' })
  }
  assert.equal(state().history.length, 50)
  assert.equal(state().history[0].mangaId, 'bulk-59')
  console.log('history ok')
}

// --- storage contract: what real visitors already have saved ---
{
  const raw = JSON.parse(storage.get('zine-library'))
  assert.equal(raw.version, 0)
  assert.deepEqual(Object.keys(raw.state).sort(), ['favorites', 'history', 'progress', 'readChapters'])
  console.log('persisted shape (zine-library, version 0) ok')
}

console.log('\nall library-store checks passed')
