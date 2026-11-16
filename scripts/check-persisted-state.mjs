// Checks for hydrating saved data (src/store/persistedState.js) and for the
// two persisted stores booting from old, damaged and unparseable storage.
// Run: node scripts/check-persisted-state.mjs
import assert from 'node:assert/strict'
import {
  mergeSettings,
  mergeLibrary,
  describeRepair,
  describeUnreadable,
} from '../src/store/persistedState.js'

const THEME_IDS = ['midnight', 'ember', 'void', 'paper', 'sakura', 'matcha']

/** The settings store's defaults, plus a stand-in action. */
const settingsDefaults = () => ({
  theme: 'midnight',
  layout: 'auto',
  background: { enabled: false, blur: 12, dim: 0.5, fit: 'cover' },
  reader: {
    mode: 'paged',
    fit: 'height',
    direction: 'rtl',
    dataSaver: false,
    preloadCount: 3,
    autoplayInterval: 8,
    smartTiming: true,
    autoScrollSpeed: 120,
    tapToPause: true,
  },
  languages: ['en'],
  contentRatings: ['safe', 'suggestive'],
  readableOnly: true,
  apiProxy: '',
  setTheme: () => {},
})

const libraryDefaults = () => ({
  favorites: {},
  progress: {},
  readChapters: {},
  history: [],
  markRead: () => {},
})

/* What a visitor of the live site has in localStorage today — captured from
 * a real session (MangaDex uuid, Comick "ck:" and local "local:" ids). */
const savedSettings = () => ({
  theme: 'paper',
  layout: 'auto',
  background: { enabled: false, blur: 12, dim: 0.5, fit: 'cover' },
  reader: {
    mode: 'vertical',
    fit: 'spread',
    direction: 'rtl',
    dataSaver: true,
    preloadCount: 3,
    autoplayInterval: 8,
    smartTiming: false,
    autoScrollSpeed: 120,
    tapToPause: true,
  },
  languages: ['pt-br'],
  contentRatings: ['safe', 'suggestive', 'erotica'],
  readableOnly: false,
  apiProxy: 'https://zine-mangadex.example.workers.dev',
})

const savedLibrary = () => ({
  favorites: {
    'a96676e5-8ae2-425e-b549-7f15dd34a6d8': {
      manga: {
        id: 'a96676e5-8ae2-425e-b549-7f15dd34a6d8',
        title: 'Paper Lanterns',
        altTitles: ['Paper Lanterns — 別名'],
        description: 'A series.',
        status: 'ongoing',
        year: 2008,
        contentRating: 'safe',
        tags: ['Action'],
        availableLanguages: ['en', 'ja'],
        coverUrl: 'https://uploads.mangadex.org/covers/a/b.jpg',
        coverThumbUrl: 'https://uploads.mangadex.org/covers/a/b.jpg.256.jpg',
        source: 'mangadex',
      },
      addedAt: 1794835930631,
    },
    'ck:AbC123': {
      manga: { id: 'ck:AbC123', title: 'Static Bloom', coverThumbUrl: null, source: 'comick' },
      addedAt: 1794835931112,
    },
    'local:solo-max-lx3k2': {
      manga: { id: 'local:solo-max-lx3k2', title: 'Solo Max', coverThumbUrl: 'data:image/jpeg;base64,AAAA', isLocal: true },
      addedAt: 1794835931999,
    },
  },
  progress: {
    'a96676e5-8ae2-425e-b549-7f15dd34a6d8': {
      chapterId: 'c1',
      chapterLabel: 'Ch. 7 — The Print Room',
      page: 2,
      totalPages: 13,
      updatedAt: 1794835933254,
    },
    'local:solo-max-lx3k2': {
      chapterId: 'local:ch-lx3k9-ab12c',
      chapterLabel: 'Ch. 1 — Chapter 12',
      page: 0,
      totalPages: 197,
      updatedAt: 1794835932637,
    },
  },
  readChapters: { 'a96676e5-8ae2-425e-b549-7f15dd34a6d8': { c0: true }, 'ck:AbC123': {} },
  history: [
    {
      mangaId: 'a96676e5-8ae2-425e-b549-7f15dd34a6d8',
      title: 'Paper Lanterns',
      coverThumbUrl: 'https://uploads.mangadex.org/covers/a/b.jpg.256.jpg',
      chapterId: 'c1',
      chapterLabel: 'Ch. 7 — The Print Room',
      at: 1794835933188,
    },
    { mangaId: 'local:solo-max-lx3k2', title: 'Solo Max', coverThumbUrl: null, chapterId: 'local:ch-lx3k9-ab12c', chapterLabel: 'Ch. 1', at: 1794835931532 },
  ],
})

// --- existing visitors lose nothing ---
{
  const saved = savedSettings()
  const { state, repaired } = mergeSettings(saved, settingsDefaults(), THEME_IDS)
  assert.deepEqual(repaired, [])
  for (const key of Object.keys(saved)) assert.deepEqual(state[key], saved[key], `settings.${key} kept`)
  assert.equal(typeof state.setTheme, 'function', 'store actions survive the merge')
  console.log('settings: a current visitor keeps every value ok')
}
{
  const saved = savedLibrary()
  const { state, repaired } = mergeLibrary(saved, libraryDefaults())
  assert.deepEqual(repaired, [])
  // Same references: valid sections are passed through, not rebuilt.
  assert.equal(state.favorites, saved.favorites)
  assert.equal(state.progress, saved.progress)
  assert.equal(state.readChapters, saved.readChapters)
  assert.equal(state.history, saved.history)
  assert.equal(typeof state.markRead, 'function')
  console.log('library: a current visitor keeps every entry, untouched ok')
}

// --- MIGRATION: settings saved by the first deployed build (2026-07-02) ---
// reader.smartTiming did not exist yet. A shallow merge replaced the whole
// reader group, leaving smartTiming undefined (so "on by default" was off).
{
  const firstBuild = {
    theme: 'ember',
    background: { enabled: false, blur: 12, dim: 0.5, fit: 'cover' },
    reader: {
      mode: 'vertical',
      fit: 'width',
      direction: 'ltr',
      dataSaver: true,
      preloadCount: 5,
      autoplayInterval: 12,
      autoScrollSpeed: 200,
      tapToPause: false,
    },
    languages: ['ja'],
    contentRatings: ['safe'],
  }
  const { state, repaired } = mergeSettings(firstBuild, settingsDefaults(), THEME_IDS)
  assert.deepEqual(repaired, [], 'filling a never-saved key is a migration, not damage')
  assert.equal(state.reader.smartTiming, true, 'new nested key takes its default')
  assert.deepEqual(
    { ...state.reader, smartTiming: undefined },
    { ...firstBuild.reader, smartTiming: undefined },
    'every reader value the visitor chose is kept',
  )
  assert.equal(state.theme, 'ember')
  assert.equal(state.layout, 'auto', 'top-level key added later takes its default')
  assert.equal(state.readableOnly, true)
  assert.equal(state.apiProxy, '')
  assert.deepEqual(state.languages, ['ja'])
  console.log('settings: first-build shape migrates without loss ok')
}

// --- nothing saved yet ---
{
  const defaults = settingsDefaults()
  assert.equal(mergeSettings(undefined, defaults, THEME_IDS).state, defaults)
  assert.deepEqual(mergeSettings(null, defaults, THEME_IDS).repaired, [])
  const empty = libraryDefaults()
  assert.equal(mergeLibrary(undefined, empty).state, empty)
  assert.deepEqual(mergeLibrary(undefined, empty).repaired, [])
  console.log('first visit: defaults, nothing reported ok')
}

// --- damaged settings fall back per field and are reported ---
{
  const { state, repaired } = mergeSettings(
    {
      theme: 'neon',
      layout: 'sideways',
      background: 'yes',
      reader: { mode: 'paged', fit: 'banana', autoplayInterval: 'fast', preloadCount: 99, autoScrollSpeed: -5, smartTiming: 'on' },
      languages: [],
      contentRatings: 'safe',
      readableOnly: 'true',
      apiProxy: 42,
    },
    settingsDefaults(),
    THEME_IDS,
  )
  assert.equal(state.theme, 'midnight')
  assert.equal(state.layout, 'auto')
  assert.deepEqual(state.background, settingsDefaults().background)
  assert.equal(state.reader.mode, 'paged')
  assert.equal(state.reader.fit, 'height')
  assert.equal(state.reader.autoplayInterval, 8)
  assert.equal(state.reader.preloadCount, 8, 'a number out of range is clamped, not discarded')
  assert.equal(state.reader.autoScrollSpeed, 40)
  assert.equal(state.reader.smartTiming, true)
  assert.equal(state.reader.direction, 'rtl', 'a missing field inside a damaged group still defaults')
  assert.deepEqual(state.languages, ['en'])
  assert.deepEqual(state.contentRatings, ['safe', 'suggestive'])
  assert.equal(state.readableOnly, true)
  assert.equal(state.apiProxy, '')
  assert.deepEqual(repaired, [
    'theme',
    'layout',
    'background',
    'reader fit',
    'reader autoplayInterval',
    'reader smartTiming',
    'chapter language',
    'content ratings',
    'readable-only filter',
    'API proxy',
  ])
  // REGRESSION: reader: null used to blank the app ("reading 'dataSaver'").
  const nulled = mergeSettings({ reader: null }, settingsDefaults(), THEME_IDS)
  assert.deepEqual(nulled.state.reader, settingsDefaults().reader)
  assert.deepEqual(nulled.repaired, ['reader'])
  assert.deepEqual(mergeSettings('garbage', settingsDefaults(), THEME_IDS).repaired, ['all settings'])
  console.log('settings: damage repaired field by field and reported ok')
}

// --- damaged library: drop the unusable entry, keep its neighbours ---
{
  // REGRESSION: history: null blanked the app ("reading 'filter'").
  const nulled = mergeLibrary({ history: null, favorites: null }, libraryDefaults())
  assert.deepEqual(nulled.state.history, [])
  assert.deepEqual(nulled.state.favorites, {})
  assert.deepEqual(nulled.repaired, ['favorites', 'history'])

  const saved = savedLibrary()
  const good = saved.favorites['ck:AbC123']
  const { state, repaired } = mergeLibrary(
    {
      favorites: { ...saved.favorites, broken: { manga: null, addedAt: 1 }, noId: { manga: { title: 'x' } }, undated: { manga: { id: 'u1', title: 'Undated' } } },
      progress: {
        ...saved.progress,
        noChapter: { page: 3 },
        badNumbers: { chapterId: 'c9', page: 'three', totalPages: null },
      },
      readChapters: { m1: { c1: true, c2: 'yes', c3: false, c4: 0 }, m2: 'all' },
      history: [...saved.history, null, 'junk', { mangaId: 'm9' }, { mangaId: 'm8', chapterId: 'c8' }],
    },
    libraryDefaults(),
  )
  assert.deepEqual(Object.keys(state.favorites).sort(), [...Object.keys(saved.favorites), 'undated'].sort())
  assert.equal(state.favorites['ck:AbC123'], good, 'valid neighbours are kept as they were')
  assert.equal(state.favorites.undated.addedAt, 0, 'a usable entry with a missing timestamp is kept')
  assert.equal(state.progress.noChapter, undefined, 'progress without a chapter cannot be resumed')
  assert.deepEqual(state.progress.badNumbers, { chapterId: 'c9', page: 0, totalPages: 0, chapterLabel: '', updatedAt: 0 })
  assert.equal(Object.keys(state.progress).length, 3)
  assert.deepEqual(state.readChapters, { m1: { c1: true, c2: true } })
  assert.equal(state.history.length, 3)
  assert.deepEqual(state.history[2], { mangaId: 'm8', chapterId: 'c8', title: '', chapterLabel: '', at: 0 })
  assert.deepEqual(repaired, ['favorites', 'reading progress', 'read marks', 'history'])
  assert.deepEqual(mergeLibrary([], libraryDefaults()).repaired, ['the whole library'])
  console.log('library: unusable entries dropped, neighbours kept, reported ok')
}

// --- the sentences shown to the user ---
assert.equal(
  describeRepair('settings', ['theme', 'reader fit', 'theme']),
  'Some saved settings were unreadable and are back on their defaults: theme, reader fit.',
)
assert.equal(
  describeRepair('library', ['history']),
  'Part of your saved library was unreadable and was left out: history.',
)
assert.match(describeUnreadable('library'), /could not be read at all/)
assert.match(describeUnreadable('settings'), /could not be read at all/)
console.log('repair messages ok')

/* ------------------------------------------------------------------------
 * The real stores, booting from storage in each condition. Stores hydrate
 * at import time, so each case runs in a fresh module instance.
 * --------------------------------------------------------------------- */

let instance = 0
/** Let queued microtasks (the write-back after a repair) run. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

async function boot(stored) {
  const storage = new Map(Object.entries(stored))
  globalThis.window = {
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
  }
  const warnings = []
  const realWarn = console.warn
  console.warn = (...args) => warnings.push(args.map(String).join(' '))
  const tag = `?instance=${++instance}`
  try {
    // The toast store is the one shared instance the stores themselves
    // import; only the two persisted stores are re-instantiated per case.
    const { useToasts } = await import('../src/store/useToasts.js')
    useToasts.setState({ toasts: [] })
    const { useSettings } = await import(`../src/store/useSettings.js${tag}`)
    const { useLibrary } = await import(`../src/store/useLibrary.js${tag}`)
    return {
      settings: useSettings.getState(),
      library: useLibrary.getState(),
      toasts: useToasts.getState().toasts.map((t) => t.message),
      warnings,
      storage,
    }
  } finally {
    console.warn = realWarn
  }
}

// A healthy visitor: everything restored, nothing announced.
{
  const { settings, library, toasts, warnings } = await boot({
    'zine-settings': JSON.stringify({ state: savedSettings(), version: 0 }),
    'zine-library': JSON.stringify({ state: savedLibrary(), version: 0 }),
  })
  assert.equal(settings.theme, 'paper')
  assert.equal(settings.reader.fit, 'spread')
  assert.equal(settings.apiProxy, 'https://zine-mangadex.example.workers.dev')
  assert.equal(Object.keys(library.favorites).length, 3)
  assert.equal(library.history.length, 2)
  assert.equal(library.progress['local:solo-max-lx3k2'].totalPages, 197)
  assert.deepEqual(toasts, [])
  assert.deepEqual(warnings, [])
  console.log('stores: healthy storage restores silently ok')
}

// Wrong-typed values: the app must come up, and say what it reset.
{
  const { settings, library, toasts, warnings, storage } = await boot({
    'zine-settings': JSON.stringify({ state: { theme: 'paper', reader: null }, version: 0 }),
    'zine-library': JSON.stringify({ state: { history: null, favorites: savedLibrary().favorites }, version: 0 }),
  })
  assert.equal(settings.theme, 'paper', 'the usable part of damaged settings is kept')
  assert.equal(settings.reader.dataSaver, false)
  assert.deepEqual(library.history, [])
  assert.equal(Object.keys(library.favorites).length, 3, 'the usable part of a damaged library is kept')
  assert.equal(toasts.length, 2)
  assert.ok(toasts.some((m) => m.includes('reader')), 'settings repair names the reader group')
  assert.ok(toasts.some((m) => m.includes('history')), 'library repair names history')
  assert.equal(warnings.length, 2)
  console.log('stores: wrong-typed values repaired and announced ok')

  // The repaired state is saved straight back, so the notice appears once —
  // not again on every later visit.
  await settled()
  const rewritten = JSON.parse(storage.get('zine-library'))
  assert.deepEqual(rewritten.state.history, [])
  assert.equal(Object.keys(rewritten.state.favorites).length, 3)
  assert.equal(JSON.parse(storage.get('zine-settings')).state.reader.mode, 'paged')
  const second = await boot(Object.fromEntries(storage))
  assert.deepEqual(second.toasts, [], 'the next visit is quiet')
  assert.equal(second.settings.theme, 'paper')
  console.log('stores: repair is written back and announced only once ok')
}

// Unparseable blobs: defaults, announced, then replaced by something readable.
{
  const { settings, library, toasts, storage } = await boot({ 'zine-settings': '{oops', 'zine-library': 'not json at all' })
  assert.equal(settings.theme, 'midnight')
  assert.deepEqual(library.favorites, {})
  assert.equal(toasts.length, 2)
  assert.ok(toasts.every((m) => m.includes('could not be read at all')))
  await settled()
  assert.equal(JSON.parse(storage.get('zine-library')).version, 0)
  assert.deepEqual((await boot(Object.fromEntries(storage))).toasts, [])
  console.log('stores: unparseable storage announced once ok')
}

// First visit: defaults, silence, and nothing written until something changes.
{
  const { settings, library, toasts, storage } = await boot({})
  assert.equal(settings.reader.smartTiming, true)
  assert.deepEqual(library.history, [])
  assert.deepEqual(toasts, [])
  assert.equal(storage.size, 0)
  console.log('stores: first visit ok')
}

console.log('\nall persisted-state checks passed')
