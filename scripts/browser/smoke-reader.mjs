// Mobile-viewport regression for the reader: slider scrubber fit + scrub,
// the chrome (panel) visibility rules, resume position, and vertical-mode
// progress.
// Needs: a fixtures build or dev server (VITE_USE_FIXTURES=1) and Playwright
// with Chromium. Environment:
//   SMOKE_BASE             app URL incl. any base path, no trailing slash
//                          (default http://localhost:5173; e.g. http://localhost:4173/Zine)
//   PLAYWRIGHT_MODULE_DIR  directory to resolve `playwright` from (with trailing slash)
import { createRequire } from 'node:module'
const require = createRequire(
  process.env.PLAYWRIGHT_MODULE_DIR ?? '/opt/node22/lib/node_modules/',
)
const { chromium, devices } = require('playwright')

const BASE = (process.env.SMOKE_BASE ?? 'http://localhost:5173').replace(/\/+$/, '')
const errors = []
const browser = await chromium.launch()
const context = await browser.newContext({ ...devices['iPhone 13'] })
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  // A deep link on a static host is served as 404.html with HTTP 404.
  if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(`console: ${m.text()}`)
})
const viewportWidth = devices['iPhone 13'].viewport.width
const centerX = viewportWidth / 2
const controls = () =>
  page.locator('button[aria-label="Start autoplay"], button[aria-label="Pause autoplay"]')
// Everything on the reader chrome is TAPPED, never clicked: page.click()
// synthesises a mouse pointer, and the panel deliberately never hides while
// a mouse rests on it — a phone only ever produces touch pointers.
const tap = (selector) => page.locator(selector).tap()
/** Bring the panel up (a center tap toggles it, so only tap when it is hidden). */
async function showChrome() {
  if ((await controls().count()) === 0) await page.touchscreen.tap(centerX, 400)
  await controls().first().waitFor({ timeout: 3000 })
}

await page.goto(`${BASE}/manga/fixture-manga-1`)
await page.waitForSelector('text=Volume 1', { timeout: 10000 })
await page.click('a[href*="/read/fixture-manga-1/"]')
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

/* Chrome rules (see the "chrome idle" block in ReaderPage):
 *  - the panel ALWAYS auto-hides after 4s without interaction, playing or not;
 *  - a center tap toggles it;
 *  - a center tap while autoplay is running pauses AND shows it. */
await page.waitForTimeout(4800)
if ((await controls().count()) !== 0) errors.push('panel did not auto-hide after 4s idle')
else console.log('idle: panel auto-hides ok')
await page.touchscreen.tap(centerX, 400)
await page.waitForSelector('button[aria-label="Start autoplay"]', { timeout: 3000 })
console.log('tap shows ok')
await page.touchscreen.tap(centerX, 400)
await page.waitForTimeout(1200)
if ((await controls().count()) !== 0) errors.push('center tap did not hide panel')
else console.log('tap hides ok')
await page.touchscreen.tap(centerX, 400)
await page.waitForSelector('button[aria-label="Start autoplay"]', { timeout: 3000 })

// playing → auto-hide after ~4s; tap pauses AND shows
await tap('button[aria-label="Start autoplay"]')
await page.waitForTimeout(5200)
if ((await controls().count()) !== 0) errors.push('panel did not auto-hide while playing')
else console.log('playing: auto-hide ok')
await page.touchscreen.tap(centerX, 400)
await page.waitForSelector('button[aria-label="Start autoplay"]', { timeout: 3000 })
console.log('tap while playing: paused + shown ok')

// resume: leave and re-enter → saved page
await tap('a[aria-label="Back to manga"]')
await page.waitForSelector('text=Volume 1', { timeout: 8000 })
await page.click('a[href*="/read/fixture-manga-1/"]')
await page.waitForSelector('text=/5 \\/ \\d+/', { timeout: 8000 })
console.log('resume at saved page ok')

// vertical mode: the strip opens on the saved page, and scrolling moves progress
await showChrome()
await tap('button[aria-label="Switch reading mode"]')
await page.waitForSelector('div.overflow-y-auto img[alt="Page 5"]', { timeout: 5000 })
await page.waitForTimeout(600)
const savedPage = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('zine-library')).state.progress['fixture-manga-1'].page)
if ((await savedPage()) !== 4) errors.push(`vertical mode did not keep the page (saved index ${await savedPage()})`)
else console.log('vertical mode keeps the page ok')
await page.evaluate(() => {
  const strip = document.querySelector('div.overflow-y-auto')
  strip.scrollTop = document.querySelector('[data-page="8"]').offsetTop + 10
})
await page.waitForTimeout(500)
if ((await savedPage()) !== 8) errors.push(`scrolling the strip did not move progress (saved index ${await savedPage()})`)
else console.log('vertical scroll moves progress ok')
await showChrome() // then restore paged mode
await tap('button[aria-label="Switch reading mode"]')
await page.waitForSelector('img[alt="Page 9"]', { timeout: 5000 })
await showChrome()
await page.waitForSelector('text=/9 \\/ \\d+/', { timeout: 5000 })
console.log('back to paged mode on the same page ok')

await browser.close()
if (errors.length) {
  console.log('\nFAILURES:')
  for (const e of errors) console.log(' -', e)
  process.exit(1)
}
console.log('\nreader smoke passed')
