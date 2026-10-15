// Captures for the deep-space and map features: BASE=http://localhost:3096 OUT=docs/screens ONLY=a,b node scripts/screens-space.mjs
import { chromium } from '@playwright/test'

const BASE = process.env.BASE ?? 'http://localhost:3096'
const OUT = process.env.OUT ?? 'docs/screens'
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean)
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })

async function shot(name, { hash = '', viewport = { width: 1280, height: 720 }, scale = 1, wait = 9000, hideUi = false, act } = {}) {
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
  if (hideUi) await page.addStyleTag({ content: '#brand,#top,#modes,#focusbar,#fleets,#bodies,#time,#dock,#foot,#card,#scale,#toasts,.fb-hint{display:none!important}' })
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 92 })
  await ctx.close()
  process.stdout.write(`${name}\n`)
}

const solarDist = (d, seconds = 0.5) => (p) => p.evaluate(([dist, sec]) => { const k = window.__kessler; k.solarMode.solar.startZoom(k.stage.solar.camera, dist, sec) }, [d, seconds])

await shot('sp-voyager', { hash: '#body=voyager-1', wait: 10_000 })
await shot('sp-parker', { hash: '#body=parker', wait: 10_000, act: solarDist(0.9) })
await shot('sp-comet-halley', { hash: '#body=sb-1p', wait: 10_000 })
await shot('sp-comet-tail', { hash: '#body=sb-2p', wait: 10_000, act: solarDist(0.5) })
await shot('sp-dots-inner', { hash: '#solar=1', wait: 10_000, hideUi: true, act: async (p) => { await p.evaluate(() => window.__kessler.solarMode.preset('inner')); await p.waitForTimeout(4500) } })
await shot('sp-dots-outer', { hash: '#solar=1', wait: 10_000, hideUi: true, act: async (p) => { await p.evaluate(() => window.__kessler.solarMode.preset('outer')); await p.waitForTimeout(4500) } })
await shot('sp-jwst', { hash: '#body=jwst', wait: 10_000 })
await shot('sp-nasa-fleet', { hash: '#fleet=nasa', wait: 8000 })
// fly to a latitude and longitude: the borders mesh knows where the Earth is turned to
const lookAt = (lat, lon, radius) => (p) => p.evaluate(([la, lo, r]) => {
  const { stage } = window.__kessler
  let borders
  stage.scene.traverse((o) => { if (o.type === 'LineSegments' && o.material.opacity === 0.22) borders = o })
  const rad = Math.PI / 180
  const local = new stage.camera.position.constructor(Math.cos(la * rad) * Math.cos(lo * rad), Math.sin(la * rad), -Math.cos(la * rad) * Math.sin(lo * rad)).multiplyScalar(10)
  borders.updateWorldMatrix(true, false)
  stage.flyTo(borders.localToWorld(local).normalize(), r)
}, [lat, lon, radius])
await shot('sp-india-map', { hash: '', wait: 6000, hideUi: true, act: async (p) => { await lookAt(30, 79, 9.4)(p); await p.waitForTimeout(2200) } })
await shot('sp-india-map-close', { hash: '', wait: 6000, hideUi: true, act: async (p) => { await lookAt(33, 77, 8.8)(p); await p.waitForTimeout(2200) } })
await browser.close()
