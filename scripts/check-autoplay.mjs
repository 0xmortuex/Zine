// Checks for the autoplay stepper (fake timestamps, no rAF) and the
// preload window math. Run: node scripts/check-autoplay.mjs
import assert from 'node:assert/strict'
import { createStepper } from '../src/hooks/useAutoplay.js'
import { preloadWindow, isStale, PAGE_SET_TTL_MS } from '../src/lib/preload.js'

// --- basic progress accumulation ---
{
  const stepper = createStepper(1000)
  stepper.play()
  assert.deepEqual(stepper.step(0), { progress: 0, completed: false }) // first frame sets baseline
  assert.equal(stepper.step(250).progress, 0.25)
  assert.equal(stepper.step(500).progress, 0.5)
  const end = stepper.step(1000)
  assert.equal(end.progress, 1)
  assert.equal(end.completed, true)
  console.log('stepper: accumulation + completion ok')
}

// --- pause freezes, resume does not count paused time ---
{
  const stepper = createStepper(1000)
  stepper.play()
  stepper.step(0)
  stepper.step(400)
  stepper.pause()
  assert.equal(stepper.step(2000).progress, 0.4) // paused: no advance
  stepper.play()
  stepper.step(5000) // resume baseline frame — huge gap must NOT count
  assert.equal(stepper.progress(), 0.4)
  const r = stepper.step(5300)
  assert.ok(Math.abs(r.progress - 0.7) < 1e-9)
  console.log('stepper: pause/resume ok')
}

// --- reset (manual page turn) restarts the cycle ---
{
  const stepper = createStepper(1000)
  stepper.play()
  stepper.step(0)
  stepper.step(900)
  stepper.reset()
  assert.equal(stepper.progress(), 0)
  stepper.step(1000) // new baseline after reset
  assert.equal(stepper.step(1500).progress, 0.5)
  console.log('stepper: reset ok')
}

// --- duration change mid-cycle ---
{
  const stepper = createStepper(1000)
  stepper.play()
  stepper.step(0)
  stepper.step(500)
  stepper.setDuration(2000)
  assert.equal(stepper.progress(), 0.25)
  console.log('stepper: live duration change ok')
}

// --- preload window math ---
assert.deepEqual(preloadWindow(0, 10, 3, 1), [0, 1, 2, 3])
assert.deepEqual(preloadWindow(5, 10, 3, 1), [4, 5, 6, 7, 8])
assert.deepEqual(preloadWindow(9, 10, 3, 1), [8, 9])
assert.deepEqual(preloadWindow(0, 1, 3, 1), [0])
console.log('preloadWindow ok')

// --- staleness ---
assert.equal(isStale(0, PAGE_SET_TTL_MS + 1), true)
assert.equal(isStale(0, PAGE_SET_TTL_MS - 1), false)
console.log('isStale ok')

console.log('\nall autoplay/preload checks passed')
