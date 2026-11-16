// Runs every scripts/check-*.mjs in its own process (`npm test`).
// Each check is a plain node:assert script; a non-zero exit fails the run.
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const checks = readdirSync(here)
  .filter((name) => /^check-.*\.mjs$/.test(name))
  .sort()

const failed = []
for (const name of checks) {
  const result = spawnSync(process.execPath, [join(here, name)], { encoding: 'utf8' })
  if (result.status === 0) {
    console.log(`ok    ${name}`)
  } else {
    failed.push(name)
    console.log(`FAIL  ${name}`)
    console.log((result.stdout + result.stderr).trimEnd().replace(/^/gm, '      '))
  }
}

console.log(`\n${checks.length - failed.length}/${checks.length} check scripts passed`)
if (failed.length > 0) process.exit(1)
