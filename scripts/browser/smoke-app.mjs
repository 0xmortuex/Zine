// Fixtures-mode browser walkthrough of every route.
// Needs: a fixtures build or dev server (VITE_USE_FIXTURES=1) and Playwright
// with Chromium. Environment:
//   SMOKE_BASE             app URL incl. any base path, no trailing slash
//                          (default http://localhost:5173; e.g. http://localhost:4173/Zine)
//   PLAYWRIGHT_MODULE_DIR  directory to resolve `playwright` from (with trailing slash)
//   SMOKE_SHOTS            where screenshots go (default: the OS temp dir)
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
const require = createRequire(process.env.PLAYWRIGHT_MODULE_DIR ?? '/opt/node22/lib/node_modules/')
const { chromium } = require('playwright')

const BASE = (process.env.SMOKE_BASE ?? 'http://localhost:5173').replace(/\/+$/, '')
const SHOTS = process.env.SMOKE_SHOTS ?? tmpdir()
const errors = []
const fail = (message) => {
  errors.push(message)
  console.log('FAILED:', message)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
page.on('console', (msg) => {
  // A deep link on a static host is served as 404.html with HTTP 404; the
  // browser logs that one resource line, and it is expected.
  if (msg.type() === 'error' && !/status of 404/.test(msg.text())) errors.push(`console: ${msg.text()}`)
})
const counter = async () => {
  await page.mouse.move(640, 300 + Math.random() * 20) // real mouse movement revives the reader chrome
  return page.locator('header span.tnum').first().textContent()
}

// --- home / discovery rails / search ---
await page.goto(`${BASE}/`)
await page.waitForSelector('text=browse.')
await page.waitForSelector('text=most popular.')
await page.waitForTimeout(1200)
const hiddenCovers = await page.evaluate(() => {
  const main = document.querySelector('main')
  return [...main.querySelectorAll('ul img')].filter((img) => {
    for (let el = img; el && el !== main; el = el.parentElement) {
      const style = getComputedStyle(el)
      if (style.opacity === '0' || style.visibility === 'hidden') return true
    }
    return !(img.complete && img.naturalWidth > 0)
  }).length
})
if (hiddenCovers > 0) fail(`${hiddenCovers} rail covers are hidden or broken`)
else console.log('discovery rails: every cover painted')

await page.fill('input[type=search]', 'a')
await page.click('button:has-text("Search")')
await page.waitForSelector('text=/showing/', { timeout: 5000 })
const cards = await page.locator('main ul a[href*="/manga/"]').count()
console.log('search results rendered:', cards)
if (!page.url().endsWith('/?q=a')) fail(`search query not in the address bar: ${page.url()}`)
await page.screenshot({ path: `${SHOTS}/1-home-search.png` })

// open a result, come Back: the results must still be there
await page.click('main ul a[href$="/manga/fixture-manga-1"]')
await page.waitForSelector('text=Volume 1', { timeout: 8000 })
await page.goBack()
await page.waitForSelector('text=/showing/', { timeout: 5000 })
if ((await page.locator('main ul a[href*="/manga/"]').count()) !== cards) fail('Back from a series page lost the search results')
else console.log('Back restores the search results')

// --- detail page (flagship fixture with volumes/versions) ---
await page.goto(`${BASE}/manga/fixture-manga-1`)
await page.waitForSelector('text=chapters.', { timeout: 8000 })
await page.waitForSelector('text=Volume 1', { timeout: 8000 })
const versionChips = await page.locator('button:has-text("versions")').count()
console.log('version chips:', versionChips)
const oneshot = await page.locator('text=Oneshots').count()
const externalSec = await page.locator('text=Hosted externally').count()
console.log('oneshot section:', oneshot, '· external section:', externalSec)
await page.screenshot({ path: `${SHOTS}/2-detail.png`, fullPage: false })

// expand a version chip
if (versionChips > 0) {
  await page.locator('button:has-text("versions")').first().click()
  await page.waitForSelector('text=canonical', { timeout: 3000 })
  console.log('version expansion ok')
}

// --- reader: paged ---
await page.click('a[href*="/read/fixture-manga-1/"]')
await page.waitForSelector('img[alt^="Page"]', { timeout: 8000 })
await page.waitForSelector('text=/1 \\/ \\d+/', { timeout: 5000 })
console.log('reader loaded, page counter visible')
await page.screenshot({ path: `${SHOTS}/3-reader.png` })

// keyboard forward (RTL default → ArrowLeft is forward)
await page.keyboard.press('ArrowLeft')
await page.waitForSelector('text=/2 \\/ \\d+/', { timeout: 3000 })
console.log('keyboard page-forward ok (RTL)')

// autoplay: space starts, ring should sweep — check the dashoffset changes
await page.keyboard.press(' ')
const off1 = await page.locator('circle[stroke-dasharray]').last().evaluate((c) => c.style.strokeDashoffset)
await page.waitForTimeout(1200)
const off2 = await page.locator('circle[stroke-dasharray]').last().evaluate((c) => c.style.strokeDashoffset)
console.log('autoplay ring sweeping:', off1 !== off2, `(${off1} → ${off2})`)
if (off1 === off2) fail('autoplay ring did not move')
await page.keyboard.press(' ')

// settings sheet: Escape closes the sheet, not the reader
await page.mouse.move(640, 300)
await page.click('button[aria-label="Reader settings"]')
await page.waitForSelector('[role=dialog][aria-label="Reader settings"]')
await page.keyboard.press('Escape')
await page.waitForTimeout(700)
if ((await page.locator('[role=dialog][aria-label="Reader settings"]').count()) !== 0 || !page.url().includes('/read/')) {
  fail('Escape with the settings sheet open should close the sheet and stay in the reader')
} else console.log('Escape closes the settings sheet only')

// mode toggle → vertical
await page.keyboard.press('m')
await page.waitForSelector('div.overflow-y-auto img[alt="Page 1"]', { timeout: 5000 })
console.log('vertical mode ok')
await page.screenshot({ path: `${SHOTS}/4-reader-vertical.png` })
await page.keyboard.press('m')

// --- reader: the end of a chapter (this used to blank the whole app) ---
await page.goto(`${BASE}/read/fixture-manga-2/fixture-m2-ch-1`) // 10 pages, 5 chapters
await page.waitForSelector('text=/1 \\/ 10/', { timeout: 8000 })
for (let i = 0; i < 9; i++) {
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(120)
}
if ((await counter()) !== '10 / 10') fail(`did not reach the last page: ${await counter()}`)
else console.log('last page of a chapter reached (10 / 10)')
const marked = await page.evaluate(
  () => JSON.parse(localStorage.getItem('zine-library')).state.readChapters['fixture-manga-2']?.['fixture-m2-ch-1'],
)
if (marked !== true) fail('finishing a chapter did not mark it read')
await page.keyboard.press('ArrowLeft')
await page.waitForSelector('text=chapter finished', { timeout: 3000 })
await page.waitForURL(/fixture-m2-ch-2$/, { timeout: 6000 })
await page.waitForSelector('text=/1 \\/ 11/', { timeout: 8000 })
console.log('next-chapter interstitial → chapter 2 opens on page 1')

// --- settings: theme switch persists ---
await page.goto(`${BASE}/settings`)
await page.waitForSelector('text=settings.')
await page.click('button:has-text("Paper")')
const theme = await page.evaluate(() => document.documentElement.dataset.theme)
console.log('theme after click:', theme)
await page.screenshot({ path: `${SHOTS}/5-settings-paper.png` })
await page.reload()
await page.waitForSelector('text=settings.')
const themeAfterReload = await page.evaluate(() => document.documentElement.dataset.theme)
console.log('theme after reload:', themeAfterReload)
if (theme !== 'paper' || themeAfterReload !== 'paper') fail('theme did not persist')

// --- library/history tabs populated from the reading we just did ---
await page.goto(`${BASE}/?tab=history`)
await page.waitForSelector('text=history.')
const historyRows = await page.locator('text=resume').count()
console.log('history rows:', historyRows)
if (historyRows !== 2) fail(`expected 2 history rows, got ${historyRows}`)
await page.goto(`${BASE}/`)
await page.waitForSelector('text=continue reading.', { timeout: 5000 })
console.log('continue-reading shelf ok')
await page.screenshot({ path: `${SHOTS}/6-home-continue.png` })

// --- 404 ---
await page.goto(`${BASE}/nope`)
await page.waitForSelector('text=404')
console.log('404 ok')

await browser.close()

if (errors.length) {
  console.log('\nBROWSER ERRORS:')
  for (const e of errors) console.log(' -', e)
  process.exit(1)
}
console.log('\nsmoke test passed, no browser errors')
