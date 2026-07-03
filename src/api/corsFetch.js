/**
 * CORS-resilient JSON fetching shared by all online sources.
 *
 * Strategy per URL:
 *   1. Direct fetch (hard timeout). A parsed-JSON answer of any status is
 *      authoritative. Rate limits (429) are authoritative too.
 *   2. On a network-level failure (the CORS block, ISP block) or a garbage
 *      body (Cloudflare challenge, captive portal), race public CORS
 *      relays — first relay returning parsed JSON wins and is remembered
 *      per upstream origin. Relays answering with their own block pages,
 *      their own 429s, or timeouts are benched with cooldowns.
 *   3. Once an origin is known CORS-blocked, requests go relay-first
 *      (persisted for the session so reloads skip rediscovery).
 */

export class MangaDexError extends Error {
  constructor(message, { status, detail, network = false, invalidBody = false } = {}) {
    super(message)
    this.name = 'MangaDexError'
    this.status = status
    this.detail = detail
    this.network = network
    // True when the response body wasn't JSON at all — a relay block page,
    // Cloudflare challenge, captive portal. Never an authoritative answer.
    this.invalidBody = invalidBody
  }
}

const DIRECT_TIMEOUT_MS = 4_000
const RELAY_TIMEOUT_MS = 15_000
const RELAY_MIN_GAP_MS = 300
const COOLDOWN_MS = { rateLimit: 90_000, blockPage: 300_000, network: 30_000 }

/**
 * Only relays that verifiably still exist (probed 2026-07: corsproxy.io
 * demands an API key, cors.eu.org / cors.lol / htmldriven are dead or
 * rejecting). A short pool of real services beats a long pool of ghosts —
 * dead entries just add seconds of timeout before every failure.
 */
export const PUBLIC_RELAYS = [
  {
    name: 'allorigins',
    wrap: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'codetabs',
    wrap: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  },
  {
    // allorigins' JSON envelope endpoint — different code path server-side.
    name: 'allorigins-json',
    wrap: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    unwrap: (envelope) => ({
      status: envelope?.status?.http_code ?? 200,
      body: JSON.parse(envelope?.contents ?? ''),
    }),
  },
]

export const RELAYS_DOWN_MESSAGE =
  'Could not reach the source: the direct connection is blocked (CORS or network) and no public ' +
  'relay responded. If this keeps happening, your network may be blocking manga sites — try a ' +
  'VPN, or set a personal API proxy in Settings → Content.'

export const RELAYS_COOLING_MESSAGE =
  'The public relays are cooling down after failures or rate limits. Wait a minute and retry — ' +
  'or set a personal API proxy in Settings → Content for an always-fast connection.'

/* ------------------------------ health state ------------------------------ */

const STATE_KEY = 'zine:relay-state-v2'
// CORS-block marks are IN-MEMORY ONLY and expire: persisting them broke
// recovery — turning a VPN on and refreshing kept skipping the (now
// working) direct path for the whole session. Re-probing direct costs at
// most one 4s timeout every couple of minutes.
const BLOCK_TTL_MS = 2 * 60_000
const blockedOriginsAt = new Map() // origin -> timestamp of last network failure
const winnerByOrigin = new Map()

const isBlocked = (origin) => {
  const at = blockedOriginsAt.get(origin)
  if (!at) return false
  if (Date.now() - at > BLOCK_TTL_MS) {
    blockedOriginsAt.delete(origin)
    return false
  }
  return true
}
// Cooldowns are PER (upstream origin, relay): a relay that Comick's bot
// protection block-pages may still be perfectly fine for MangaDex — one
// misbehaving source must not poison the shared pool for the others.
const relayCooldownUntil = new Map() // `${origin}|${relayIndex}` -> timestamp
const relayLastStart = PUBLIC_RELAYS.map(() => 0)

const cooldownKey = (origin, index) => `${origin}|${index}`
const cooledUntil = (origin, index) => relayCooldownUntil.get(cooldownKey(origin, index)) ?? 0

function loadState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STATE_KEY))
    for (const [origin, index] of Object.entries(saved?.winners ?? {})) {
      if (Number.isInteger(index)) winnerByOrigin.set(origin, index)
    }
  } catch {
    /* no persisted state */
  }
}

function saveState() {
  try {
    sessionStorage.setItem(
      STATE_KEY,
      JSON.stringify({ winners: Object.fromEntries(winnerByOrigin) }),
    )
  } catch {
    /* storage unavailable */
  }
}

if (typeof sessionStorage !== 'undefined') loadState()

export function isCorsBlocked(origin) {
  return isBlocked(origin)
}

/** Test hook: reset all discovery/health state. */
export function __resetCorsState() {
  blockedOriginsAt.clear()
  winnerByOrigin.clear()
  relayCooldownUntil.clear()
  relayLastStart.fill(0)
}

/* -------------------------------- plumbing -------------------------------- */

function makeSignal(timeoutMs, external) {
  const timeout = AbortSignal.timeout?.(timeoutMs)
  if (timeout && external && AbortSignal.any) return AbortSignal.any([timeout, external])
  return external ?? timeout
}

async function rawFetch(url, timeoutMs, externalSignal) {
  let res
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: makeSignal(timeoutMs, externalSignal),
    })
  } catch (err) {
    throw new MangaDexError('Network error reaching the source', {
      detail: err.message,
      network: true,
    })
  }
  const body = await res.json().catch(() => null)
  return { status: res.status, statusText: res.statusText, body }
}

async function relayFetch(index, directUrl, externalSignal) {
  const gap = relayLastStart[index] + RELAY_MIN_GAP_MS - Date.now()
  if (gap > 0) await new Promise((resolve) => setTimeout(resolve, gap))
  relayLastStart[index] = Date.now()

  const origin = new URL(directUrl).origin
  const relay = PUBLIC_RELAYS[index]
  try {
    const result = await rawFetch(relay.wrap(directUrl), RELAY_TIMEOUT_MS, externalSignal)
    let { status, body } = result
    if (relay.unwrap) {
      if (!body) throw new MangaDexError(`Relay ${relay.name} returned garbage`, { invalidBody: true })
      const inner = relay.unwrap(body) // throws on bad envelope → relay failure
      status = inner.status
      body = inner.body
    }
    if (status === 429) {
      const err = new MangaDexError(`Relay ${relay.name} rate-limited`, { network: true })
      err.rateLimited = true
      throw err
    }
    if (!body) {
      throw new MangaDexError(`Relay ${relay.name} returned a non-JSON page`, {
        status,
        invalidBody: true,
      })
    }
    return { status, statusText: result.statusText, body }
  } catch (err) {
    const ms = err.rateLimited
      ? COOLDOWN_MS.rateLimit
      : err.invalidBody
        ? COOLDOWN_MS.blockPage
        : COOLDOWN_MS.network
    relayCooldownUntil.set(cooldownKey(origin, index), Date.now() + ms)
    throw err
  }
}

function raceRelays(directUrl, indexes) {
  const controllers = indexes.map(() => new AbortController())
  const origin = new URL(directUrl).origin
  return new Promise((resolve, reject) => {
    let pending = indexes.length
    let lastError = null
    let settled = false
    indexes.forEach((relayIndex, i) => {
      relayFetch(relayIndex, directUrl, controllers[i].signal).then(
        (result) => {
          if (settled) return
          settled = true
          winnerByOrigin.set(origin, relayIndex)
          saveState()
          controllers.forEach((c, j) => j !== i && c.abort())
          resolve(result)
        },
        (err) => {
          if (settled) return
          lastError = err
          if (--pending === 0) {
            settled = true
            reject(
              new MangaDexError(RELAYS_DOWN_MESSAGE, { network: true, detail: lastError?.detail }),
            )
          }
        },
      )
    })
  })
}

/**
 * Fetch JSON with the full direct → relay-race pipeline.
 * Resolves { status, statusText, body } where body is PARSED JSON — the
 * caller applies source-specific semantics. Rejects with a network-flagged
 * MangaDexError only when nothing was reachable.
 */
export async function fetchJsonResilient(url, { skipRelays = false } = {}) {
  const origin = new URL(url).origin
  const isBrowser = typeof window !== 'undefined'

  if (skipRelays || !isBrowser || !isBlocked(origin)) {
    try {
      const result = await rawFetch(url, skipRelays ? RELAY_TIMEOUT_MS : DIRECT_TIMEOUT_MS)
      // Parsed JSON of any status — and bodyless rate limits — are
      // authoritative answers from the source itself.
      if (result.body || result.status === 429) return result
      if (skipRelays || !isBrowser) return result
    } catch (err) {
      if (skipRelays || !isBrowser || !(err instanceof MangaDexError) || !err.network) throw err
      blockedOriginsAt.set(origin, Date.now())
    }
  }

  // Steady state: reuse this origin's winning relay; on failure, re-race.
  const winner = winnerByOrigin.get(origin)
  if (winner != null && cooledUntil(origin, winner) <= Date.now()) {
    try {
      return await relayFetch(winner, url)
    } catch {
      winnerByOrigin.delete(origin)
      saveState()
    }
  }

  const now = Date.now()
  const eligible = PUBLIC_RELAYS.map((_, i) => i).filter((i) => cooledUntil(origin, i) <= now)
  if (eligible.length === 0) {
    throw new MangaDexError(RELAYS_COOLING_MESSAGE, { network: true })
  }
  return raceRelays(url, eligible)
}
