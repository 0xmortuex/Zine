// Checks for the smart page-timing model (pure math — the pixel sampler
// needs a DOM and is exercised by the browser smoke test).
// Run: node scripts/check-page-timing.mjs
import assert from 'node:assert/strict'
import { computeReadSeconds } from '../src/lib/pageTiming.js'

const BASE = 8

// Standard page, unknown density → base time.
assert.equal(computeReadSeconds(BASE, 1.45, null), BASE)

// Tall webtoon-style page reads longer; wide spread reads a bit shorter.
assert.ok(computeReadSeconds(BASE, 3.0, null) > BASE * 1.8)
assert.ok(computeReadSeconds(BASE, 0.7, null) < BASE)

// Density scales time: sparse art page shorter, text-dense page longer.
const sparse = computeReadSeconds(BASE, 1.45, 0.05)
const dense = computeReadSeconds(BASE, 1.45, 0.85)
assert.ok(sparse < BASE, `sparse (${sparse}) should be under base`)
assert.ok(dense > BASE * 1.5, `dense (${dense}) should be well over base`)
assert.ok(dense / sparse > 2, 'dense pages should get at least 2x sparse pages')

// Hard floors/ceilings: never absurdly short or long.
assert.ok(computeReadSeconds(1, 0.5, 0) >= 2)
assert.ok(computeReadSeconds(60, 6, 1) <= 90)

// Monotonic in busyness.
let prev = 0
for (let b = 0; b <= 1; b += 0.25) {
  const t = computeReadSeconds(BASE, 1.45, b)
  assert.ok(t >= prev, 'read time must not decrease as density rises')
  prev = t
}

console.log('all page-timing checks passed')
