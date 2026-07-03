// Fixtures-mode browser walkthrough of every route.
import { createRequire } from 'node:module'
const require = createRequire('/opt/node22/lib/node_modules/')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5173'
const SHOTS = '/tmp'
const errors = []

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
})

// --- home / search ---
await page.goto(BASE)
await page.waitForSelector('text=browse.')
await page.fill('input[type=search]', 'a')
await page.click('button:has-text("Search")')
await page.waitForSelector('img[alt=""]', { timeout: 5000 })
const cards = await page.locator('a[href^="/manga/"]').count()
console.log('search results rendered:', cards)
await page.screenshot({ path: `${SHOTS}/1-home-search.png` })

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
await page.click('a[href^="/read/fixture-manga-1/"]')
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
await page.keyboard.press(' ')

// mode toggle → vertical
await page.keyboard.press('m')
await page.waitForSelector('div.overflow-y-auto img[alt="Page 1"]', { timeout: 5000 })
console.log('vertical mode ok')
await page.screenshot({ path: `${SHOTS}/4-reader-vertical.png` })
await page.keyboard.press('m')

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

// --- library/history tabs populated from the reading we just did ---
await page.goto(`${BASE}/?tab=history`)
await page.waitForSelector('text=history.')
const historyRows = await page.locator('text=resume').count()
console.log('history rows:', historyRows)
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
