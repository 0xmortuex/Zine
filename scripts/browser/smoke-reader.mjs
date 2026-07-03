// Mobile-viewport regression for the reader: slider scrubber fit + scrub,
// resume position, and the chrome (panel) visibility rules.
// Needs: a fixtures dev server (VITE_USE_FIXTURES=1 npm run dev -- --port 5173)
// and Playwright with Chromium available.
import { createRequire } from 'node:module'
const require = createRequire(
  process.env.PLAYWRIGHT_MODULE_DIR ?? '/opt/node22/lib/node_modules/',
)
const { chromium, devices } = require('playwright')

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5173'
const errors = []
const browser = await chromium.launch()
const context = await browser.newContext({ ...devices['iPhone 13'] })
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
const viewportWidth = devices['iPhone 13'].viewport.width
const centerX = viewportWidth / 2
const controls = () =>
  page.locator('button[aria-label="Start autoplay"], button[aria-label="Pause autoplay"]')

await page.goto(`${BASE}/manga/fixture-manga-1`)
await page.waitForSelector('text=Volume 1', { timeout: 10000 })
await page.click('a[href^="/read/fixture-manga-1/"]')
await page.waitForSelector('img[alt^="Page"]', { timeout: 8000 })
await page.waitForSelector('text=/1 \\/ \\d+/')

// slider scrubber present and capsule fits viewport
await page.waitForSelector('input[type=range][aria-label="Page"]', { timeout: 4000 })
const box = await page
  .locator('input[type=range][aria-label="Page"]')
  .locator('xpath=ancestor::div[contains(@class,"frosted")]')
  .boundingBox()
if (box.width > viewportWidth) errors.push('capsule overflows viewport')
else console.log('capsule fits viewport ok')

// scrub to page 5
await page.locator('input[type=range][aria-label="Page"]').evaluate((el) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, '4')
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
})
await page.waitForSelector('text=/5 \\/ \\d+/', { timeout: 4000 })
console.log('slider scrub ok')

// chrome rules: paused → panel persists; center tap toggles
await page.waitForTimeout(4800)
if ((await controls().count()) === 0) errors.push('panel auto-hid while paused')
else console.log('paused: panel stays ok')
await page.touchscreen.tap(centerX, 400)
await page.waitForTimeout(1200)
if ((await controls().count()) !== 0) errors.push('center tap did not hide panel')
else console.log('tap hides ok')
await page.touchscreen.tap(centerX, 400)
await page.waitForSelector('button[aria-label="Start autoplay"]', { timeout: 3000 })
console.log('tap shows ok')

// playing → auto-hide after ~4s; tap pauses AND shows
await page.click('button[aria-label="Start autoplay"]')
await page.waitForTimeout(5200)
if ((await controls().count()) !== 0) errors.push('panel did not auto-hide while playing')
else console.log('playing: auto-hide ok')
await page.touchscreen.tap(centerX, 400)
await page.waitForSelector('button[aria-label="Start autoplay"]', { timeout: 3000 })
console.log('tap while playing: paused + shown ok')

// resume: leave and re-enter → saved page
await page.click('a[aria-label="Back to manga"]')
await page.waitForSelector('text=Volume 1', { timeout: 8000 })
await page.click('a[href^="/read/fixture-manga-1/"]')
await page.waitForSelector('text=/5 \\/ \\d+/', { timeout: 8000 })
console.log('resume at saved page ok')

await browser.close()
if (errors.length) {
  console.log('\nFAILURES:')
  for (const e of errors) console.log(' -', e)
  process.exit(1)
}
console.log('\nreader smoke passed')
