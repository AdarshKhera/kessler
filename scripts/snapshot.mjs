// Offline fallback: node scripts/snapshot.mjs  (writes public/data/<group>.json)
// Idempotent and polite: skips groups already on disk, never retries inside a run.
// CelesTrak throttles repeat pulls of the same group inside ~2h with a 403.
import { access, mkdir, writeFile } from 'node:fs/promises'

const GROUPS = [
  'stations', 'starlink', 'oneweb', 'gps-ops', 'galileo', 'beidou', 'glo-ops', 'iridium-NEXT', 'planet', 'spire',
  'weather', 'science', 'intelsat', 'ses', 'eutelsat', 'geo', 'fengyun-1c-debris', 'cosmos-2251-debris',
  'iridium-33-debris', 'cosmos-1408-debris', 'active',
]
const exists = (p) => access(p).then(() => true, () => false)

await mkdir('public/data', { recursive: true })
for (const g of GROUPS) {
  const file = `public/data/${g}.json`
  if (await exists(file)) {
    process.stdout.write(`${g} have\n`)
    continue
  }
  const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=json`)
  if (!res.ok) {
    process.stdout.write(`${g} FAILED ${res.status}\n`)
  } else {
    await writeFile(file, await res.text())
    process.stdout.write(`${g} ok\n`)
  }
  await new Promise((r) => setTimeout(r, 1500))
}

// Owner (country or operator code) per NORAD id, reduced from the SATCAT for all active objects.
const ownersFile = 'public/data/owners.json'
if (!(await exists(ownersFile))) {
  const res = await fetch('https://celestrak.org/satcat/records.php?GROUP=active&FORMAT=json')
  if (!res.ok) process.stdout.write(`owners FAILED ${res.status}\n`)
  else {
    const rows = await res.json()
    const owners = Object.fromEntries(rows.filter((r) => r.OWNER).map((r) => [String(r.NORAD_CAT_ID), r.OWNER]))
    await writeFile(ownersFile, JSON.stringify(owners))
    process.stdout.write(`owners ok (${Object.keys(owners).length})\n`)
  }
} else process.stdout.write('owners have\n')

// Indian retired satellites and launch stages: owners from SATCAT, orbits from GP NAME queries.
const FAMILIES = ['PSLV', 'GSLV', 'LVM3', 'GSAT', 'INSAT', 'IRS', 'CARTOSAT', 'RISAT', 'RESOURCESAT', 'OCEANSAT', 'KALPANA', 'IRNSS']
const extraFile = 'public/data/india-extra.json'
if (!(await exists(extraFile))) {
  const { readFile } = await import('node:fs/promises')
  const owners = JSON.parse(await readFile(ownersFile, 'utf8'))
  for (const name of FAMILIES) {
    const res = await fetch(`https://celestrak.org/satcat/records.php?NAME=${name}&FORMAT=json`)
    // SATCAT answers a plain-text message instead of JSON when nothing matches
    const text = await res.text()
    let found = []
    try {
      found = JSON.parse(text)
    } catch {
      // no records
    }
    for (const r of found) if (r.OWNER) owners[String(r.NORAD_CAT_ID)] = r.OWNER
    await new Promise((r) => setTimeout(r, 800))
  }
  await writeFile(ownersFile, JSON.stringify(owners))
  const rows = []
  for (const name of FAMILIES) {
    const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?NAME=${name}&FORMAT=json`)
    if (res.ok) rows.push(...(await res.json()))
    else process.stdout.write(`india ${name} FAILED ${res.status}\n`)
    await new Promise((r) => setTimeout(r, 800))
  }
  const indian = rows.filter((r) => owners[String(r.NORAD_CAT_ID)] === 'IND')
  await writeFile(extraFile, JSON.stringify(indian))
  process.stdout.write(`india-extra ok (${indian.length})\n`)
} else process.stdout.write('india-extra have\n')
