// Checks for the long-strip (vertical mode) geometry in src/lib/stripPosition.js.
// Run: node scripts/check-strip-position.mjs
import assert from 'node:assert/strict'
import {
  pageAtReadingLine,
  isAtStripEnd,
  isAtStripStart,
  stripStep,
  STRIP_STEP_RATIO,
} from '../src/lib/stripPosition.js'

/** Build { tops, scrollHeight } from a list of page heights. */
function strip(heights) {
  const tops = []
  let y = 0
  for (const h of heights) {
    tops.push(y)
    y += h
  }
  return { tops, scrollHeight: y }
}
const VIEW = 860

// --- REGRESSION: webtoon strips far taller than the screen ---
// Four 4800px strips in an 860px viewport. The old rule needed 50% of a page
// on screen, which is impossible here (max 18%), so the counter never left 1.
{
  const { tops, scrollHeight } = strip([4800, 4800, 4800, 4800])
  const max = scrollHeight - VIEW
  const at = (fraction) => pageAtReadingLine(tops, max * fraction, VIEW, scrollHeight)
  assert.equal(at(0), 0)
  assert.equal(at(0.1), 0)
  assert.equal(at(0.3), 1)
  assert.equal(at(0.55), 2)
  assert.equal(at(0.8), 3)
  assert.equal(at(1), 3)
  // The page changes exactly when its top edge crosses the middle of the screen.
  assert.equal(pageAtReadingLine(tops, 4800 - VIEW / 2 - 1, VIEW, scrollHeight), 0)
  assert.equal(pageAtReadingLine(tops, 4800 - VIEW / 2, VIEW, scrollHeight), 1)
  console.log('tall strips: page follows the reading line ok')
}

// --- ordinary 2:3 pages (1152px in the 768px column) ---
{
  const { tops, scrollHeight } = strip(Array(11).fill(1152))
  assert.equal(pageAtReadingLine(tops, 0, VIEW, scrollHeight), 0)
  assert.equal(pageAtReadingLine(tops, 1152 * 4 + 20, VIEW, scrollHeight), 4)
  assert.equal(pageAtReadingLine(tops, scrollHeight - VIEW, VIEW, scrollHeight), 10)
  // Every page gets its turn on the way down, in order, never skipping back.
  let previous = 0
  const visited = new Set()
  for (let top = 0; top <= scrollHeight - VIEW; top += 37) {
    const index = pageAtReadingLine(tops, top, VIEW, scrollHeight)
    assert.ok(index >= previous, 'page index must not go backwards while scrolling down')
    previous = index
    visited.add(index)
  }
  assert.equal(visited.size, 11, 'no page is skipped')
  console.log('ordinary pages: monotonic, none skipped ok')
}

// --- a short last page must still be reachable (it ends the chapter) ---
{
  const { tops, scrollHeight } = strip([2880, 2880, 144])
  const bottom = scrollHeight - VIEW
  // The reading line at the bottom sits in page 2 (index 1); only the
  // end-of-strip rule gets us to the 144px credits page.
  assert.ok(bottom + VIEW / 2 < tops[2])
  assert.equal(pageAtReadingLine(tops, bottom, VIEW, scrollHeight), 2)
  assert.equal(pageAtReadingLine(tops, bottom - 50, VIEW, scrollHeight), 1)
  console.log('short final page reached at the bottom ok')
}

// --- a short first page: the very top is still page 1 ---
{
  const { tops, scrollHeight } = strip([120, 4000, 4000])
  assert.equal(pageAtReadingLine(tops, 0, VIEW, scrollHeight), 0)
  assert.equal(pageAtReadingLine(tops, 200, VIEW, scrollHeight), 1)
  console.log('short first page ok')
}

// --- degenerate inputs ---
assert.equal(pageAtReadingLine([], 0, VIEW, 0), 0, 'no pages')
assert.equal(pageAtReadingLine([0], 0, VIEW, 1200), 0, 'single page')
assert.equal(pageAtReadingLine([0], 340, VIEW, 1200), 0, 'single page, scrolled')
{
  // Everything fits on screen at once: the whole chapter is in view.
  const { tops, scrollHeight } = strip([200, 200, 200])
  assert.equal(pageAtReadingLine(tops, 0, VIEW, scrollHeight), 2)
}
console.log('degenerate inputs ok')

// --- edges ---
assert.equal(isAtStripEnd(1000, VIEW, 1860), true)
assert.equal(isAtStripEnd(998.6, VIEW, 1860), true, 'sub-pixel scroll positions count as the end')
assert.equal(isAtStripEnd(990, VIEW, 1860), false)
assert.equal(isAtStripStart(0), true)
assert.equal(isAtStripStart(1.4), true)
assert.equal(isAtStripStart(40), false)
console.log('strip edges ok')

// --- step size ---
assert.equal(stripStep(860), Math.round(860 * STRIP_STEP_RATIO))
assert.ok(stripStep(860) < 860, 'a step keeps part of the previous screen visible')
assert.equal(stripStep(0), 1, 'never a zero step')
console.log('stripStep ok')

console.log('\nall strip-position checks passed')
