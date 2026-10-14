// Zoomed-out and zoomed-in captures for the case study: BASE=http://localhost:3096 node scripts/screens-zoom.mjs
import { chromium } from '@playwright/test'

const BASE = process.env.BASE ?? 'http://localhost:3096'
const OUT = 'docs/screens'
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })

const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean)
async function shot(name, { hash = '', viewport = { width: 1280, height: 720 }, scale = 1, wait = 3000, hideUi = false, keepLabels = false, act, clip } = {}) {
  if (ONLY.length && !ONLY.includes(name)) return
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    localStorage.setItem('kessler.welcomed.v1', '1')
    localStorage.setItem('kessler.toured.v1', '1')
  })
  await page.route(/celestrak\.org/, (r) => r.abort())
  await page.goto(`${BASE}/${hash}`)
  await page.locator('.status').waitFor({ timeout: 90_000 })
  await page.waitForTimeout(wait)
  if (act) await act(page)
  if (hideUi) await page.addStyleTag({ content: '#brand,#top,#modes,#focusbar,#fleets,#bodies,#time,#dock,#foot,#card,#scale,#toasts,.fb-hint' + (keepLabels ? '' : ',#labels') + '{display:none!important}' })
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 90, clip })
  await ctx.close()
  process.stdout.write(`${name}\n`)
}

const earthDist = (d) => (p) => p.evaluate((dist) => { const s = window.__kessler.stage; s.flyTo(s.camera.position.clone().normalize(), dist) }, d)
const solarDist = (d, seconds = 0.5) => (p) => p.evaluate(([dist, sec]) => { const k = window.__kessler; k.solarMode.solar.startZoom(k.stage.solar.camera, dist, sec) }, [d, seconds])

// zoomed OUT
await shot('zo-earth-far', { wait: 4000, hideUi: true, act: async (p) => { await earthDist(64)(p); await p.waitForTimeout(1800) } })
await shot('zo-inner-system', { hash: '#solar=1', wait: 9000, hideUi: true, act: async (p) => { await p.evaluate(() => window.__kessler.solarMode.preset('inner')); await p.waitForTimeout(4200) } })
await shot('zo-solar-whole', { hash: '#solar=1', wait: 9500, hideUi: true, act: async (p) => { await p.waitForTimeout(1500) } })

// zoomed IN
await shot('zi-iss', { hash: '#sat=25544', wait: 5000, hideUi: true, act: async (p) => { await earthDist(10.5)(p); await p.waitForTimeout(1800) } })
await shot('zi-starlink', { hash: '#fleet=spacex', wait: 5000, hideUi: true, act: async (p) => { await p.evaluate(() => { const s = window.__kessler.stage; s.flyTo(s.camera.position.clone().set(0.25, 0.95, 0.45), 11.5) }); await p.waitForTimeout(1800) } })
await shot('zi-debris', { hash: '#fleet=debris', wait: 5000, hideUi: true, act: async (p) => { await p.evaluate(() => { const s = window.__kessler.stage; s.flyTo(s.camera.position.clone().set(0.78, 0.2, -0.6), 12.5) }); await p.waitForTimeout(1800) } })
await shot('zi-saturn-rings', { hash: '#body=saturn', wait: 9000, hideUi: true, act: async (p) => { await solarDist(0.0013)(p); await p.waitForTimeout(1600) } })
await shot('zi-jupiter-moons', { hash: '#body=jupiter', wait: 9000, hideUi: true, keepLabels: true, act: async (p) => { await solarDist(0.0065)(p); await p.waitForTimeout(1600) } })
await shot('zi-earth-sats', { hash: '#body=earth', wait: 9500, hideUi: true, act: async (p) => { await solarDist(0.00034)(p); await p.waitForTimeout(2600) } })

// zoomed-in UI details (2x)
await shot('ui-card', { hash: '#sat=25544', wait: 5500, scale: 2, clip: { x: 920, y: 60, width: 340, height: 560 } })
await shot('ui-fleets', { wait: 4500, scale: 2, clip: { x: 10, y: 70, width: 240, height: 590 } })
await browser.close()
