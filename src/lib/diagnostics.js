/**
 * Connection doctor: probes every host Zine depends on FROM THE USER'S
 * DEVICE and separates the two failure layers per host:
 *   - reach: fetch in no-cors mode — succeeds (opaque) whenever the
 *     network path works at all, regardless of CORS. Failure = the
 *     network/ISP/VPN blocks the host.
 *   - cors: a normal fetch — needs the host to allow cross-origin JS.
 *     "reach ✓ but cors ✗" = host up, browser access forbidden (relay
 *     territory); "reach ✗" = blocked network (VPN territory).
 */
import { PUBLIC_RELAYS } from '../api/corsFetch'

const TIMEOUT_MS = 8000

const signal = () => AbortSignal.timeout?.(TIMEOUT_MS)

async function probeReach(url) {
  const started = Date.now()
  try {
    await fetch(url, { mode: 'no-cors', signal: signal(), cache: 'no-store' })
    return { ok: true, ms: Date.now() - started }
  } catch (err) {
    return { ok: false, ms: Date.now() - started, note: err.name }
  }
}

async function probeCors(url) {
  const started = Date.now()
  try {
    const res = await fetch(url, {
      signal: signal(),
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    return { ok: res.ok, ms: Date.now() - started, status: res.status }
  } catch (err) {
    return { ok: false, ms: Date.now() - started, note: err.name }
  }
}

const MD_TEST = 'https://api.mangadex.org/manga?limit=1'

export const DIAGNOSTIC_TARGETS = [
  { name: 'MangaDex API', url: MD_TEST },
  { name: 'MangaDex covers', url: 'https://uploads.mangadex.org/covers/', reachOnly: true },
  { name: 'Comick API', url: 'https://api.comick.fun/v1.0/search?q=a&limit=1&tachiyomi=true' },
  { name: 'Comick images', url: 'https://meo.comick.pictures/', reachOnly: true },
  { name: 'Jikan (MAL)', url: 'https://api.jikan.moe/v4/top/manga?limit=1' },
  ...PUBLIC_RELAYS.map((relay) => ({
    name: `Relay: ${relay.name}`,
    url: relay.wrap(MD_TEST),
  })),
]

/**
 * Run all probes; onRow(row) fires as each completes.
 * Row: { name, reach: {ok,ms,note}, cors?: {ok,ms,status,note} }
 */
export async function runConnectionDoctor(onRow) {
  const rows = []
  for (const target of DIAGNOSTIC_TARGETS) {
    const reach = await probeReach(target.url)
    const cors = target.reachOnly || !reach.ok ? null : await probeCors(target.url)
    const row = { name: target.name, reach, cors }
    rows.push(row)
    onRow?.(row)
  }
  return rows
}

/** Compact text summary for sharing/screenshotting. */
export function summarizeDoctor(rows) {
  return rows
    .map((row) => {
      const reach = row.reach.ok ? `reach ✓ ${row.reach.ms}ms` : `reach ✗ (${row.reach.note})`
      const cors = row.cors
        ? row.cors.ok
          ? `cors ✓ ${row.cors.status}`
          : `cors ✗ (${row.cors.status ?? row.cors.note})`
        : ''
      return `${row.name}: ${reach}${cors ? ' · ' + cors : ''}`
    })
    .join('\n')
}
