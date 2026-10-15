// High-resolution solar-system captures: BASE=http://localhost:3096 OUT=docs/screens ONLY=name1,name2 node scripts/screens-hd.mjs
import { chromium } from '@playwright/test'

const BASE = process.env.BASE ?? 'http://localhost:3096'
const OUT = process.env.OUT ?? 'docs/screens'
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean)
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })

async function shot(name, { hash = '', viewport = { width: 1280, height: 720 }, scale = 1, touch = false, wait = 9000, hideUi = false, keepLabels = false, act } = {}) {
  if (ONLY.length && !ONLY.includes(name)) return
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, hasTouch: touch })
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
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 92 })
  await ctx.close()
  process.stdout.write(`${name}\n`)
}

const solarDist = (d, seconds = 0.5) => (p) => p.evaluate(([dist, sec]) => { const k = window.__kessler; k.solarMode.solar.startZoom(k.stage.solar.camera, dist, sec) }, [d, seconds])
const settle = (ms) => (p) => p.waitForTimeout(ms)

await shot('07-solar-overview-hd', { hash: '#solar=1', wait: 10_000 })
await shot('08-saturn-hd', { hash: '#body=saturn', wait: 11_000 })
await shot('09-earth-in-solar-hd', { hash: '#body=earth', wait: 11_000, act: async (p) => { await solarDist(0.0006, 0.8)(p); await p.waitForTimeout(3000) } })
await shot('zo-solar-whole-hd', { hash: '#solar=1', wait: 10_000, hideUi: true, act: settle(1500) })
await shot('zo-inner-system-hd', { hash: '#solar=1', wait: 10_000, hideUi: true, act: async (p) => { await p.evaluate(() => window.__kessler.solarMode.preset('inner')); await p.waitForTimeout(4500) } })
await shot('zi-saturn-rings-hd', { hash: '#body=saturn', wait: 11_000, hideUi: true, act: async (p) => { await solarDist(0.0013)(p); await p.waitForTimeout(2200) } })
await shot('zi-jupiter-moons-hd', { hash: '#body=jupiter', wait: 11_000, hideUi: true, keepLabels: true, act: async (p) => { await solarDist(0.0045)(p); await p.waitForTimeout(2200) } })
await shot('zi-earth-sats-hd', { hash: '#body=earth', wait: 11_000, hideUi: true, act: async (p) => { await solarDist(0.00034)(p); await p.waitForTimeout(3200) } })
await shot('zi-earth-night-hd', { hash: '#body=earth', wait: 11_000, hideUi: true, act: async (p) => { await p.evaluate(() => window.__kessler.engine.setWarp(2)); await solarDist(0.00019)(p); await p.waitForTimeout(3000) } })
await shot('zi-mars-hd', { hash: '#body=mars', wait: 11_000, hideUi: true, act: async (p) => { await solarDist(0.00011)(p); await p.waitForTimeout(2500) } })
await shot('zi-sun-hd', { hash: '#body=sun', wait: 10_000, hideUi: true })
await shot('zi-moon-hd', { hash: '#body=moon', wait: 11_000, hideUi: true })
await shot('zi-pluto-hd', { hash: '#body=pluto', wait: 11_000, hideUi: true })
await shot('12-mobile-saturn-hd', { hash: '#body=saturn', viewport: { width: 390, height: 844 }, scale: 2, touch: true, wait: 11_000 })
await browser.close()
