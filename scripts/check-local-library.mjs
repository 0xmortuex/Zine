// Checks for the local-shelf import logic (pure parts — no DOM/IndexedDB).
// Run: node scripts/check-local-library.mjs
import assert from 'node:assert/strict'
import { zipSync } from 'fflate'
import {
  sortPageNames,
  isImageEntry,
  chapterTitleFromFilename,
  extractPagesFromZip,
  isLocalId,
} from '../src/lib/localLibrary.js'

// --- natural page ordering ---
assert.deepEqual(sortPageNames(['p10.png', 'p2.png', 'p1.png']), ['p1.png', 'p2.png', 'p10.png'])
assert.deepEqual(sortPageNames(['011.jpg', '002.jpg', '101.jpg']), ['002.jpg', '011.jpg', '101.jpg'])
console.log('sortPageNames ok')

// --- image entry filtering ---
assert.ok(isImageEntry('pages/001.jpg'))
assert.ok(isImageEntry('cover.WEBP'))
assert.ok(!isImageEntry('info.txt'))
assert.ok(!isImageEntry('__MACOSX/._001.jpg')) // resource-fork junk
console.log('isImageEntry ok')

// --- chapter titles from filenames ---
assert.equal(chapterTitleFromFilename('One Slash Ch. 12.cbz'), 'Chapter 12')
assert.equal(chapterTitleFromFilename('series_chapter_003.5.zip'), 'Chapter 003.5')
assert.equal(chapterTitleFromFilename('oneshot.cbz'), 'oneshot')
console.log('chapterTitleFromFilename ok')

// --- zip extraction: images only, natural order, mime inferred ---
{
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
  const zipped = zipSync({
    'p10.png': png,
    'p2.jpg': jpg,
    'p1.png': png,
    'notes.txt': new Uint8Array([1, 2]),
    '__MACOSX/._p1.png': png,
  })
  const pages = extractPagesFromZip(zipped)
  assert.deepEqual(
    pages.map((p) => p.name),
    ['p1.png', 'p2.jpg', 'p10.png'],
  )
  assert.deepEqual(
    pages.map((p) => p.mime),
    ['image/png', 'image/jpeg', 'image/png'],
  )
  assert.ok(pages.every((p) => p.bytes.length > 0))
  console.log('extractPagesFromZip ok')
}

// --- id routing ---
assert.ok(isLocalId('local:one-slash-abc'))
assert.ok(!isLocalId('a96676e5-8ae2-425e-b549-7f15dd34a6d8'))
console.log('isLocalId ok')

console.log('\nall local-library checks passed')
