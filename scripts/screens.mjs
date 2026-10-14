// Captures the case-study screenshots at native resolution: BASE=http://localhost:3096 node scripts/screens.mjs
import { chromium } from '@playwright/test'

const BASE = process.env.BASE ?? 'http://localhost:3096'
const OUT = 'docs/screens'
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })

async function shot(name, { hash = '', viewport = { width: 1280, height: 720 }, scale = 1, touch = false, wait = 2500, act } = {}) {
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
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 90 })
  await ctx.close()
  process.stdout.write(`${name}\n`)
}

await shot('01-earth', { wait: 4000 })
await shot('02-satellite-iss', { hash: '#sat=25544', wait: 5000 })
await shot('03-fleet-spacex', { hash: '#fleet=spacex', wait: 4000 })
await shot('04-debris', { hash: '#fleet=debris', wait: 4000 })
await shot('05-india', { hash: '#country=ind', wait: 5000 })
await shot('06-guide-data', { wait: 3000, act: async (p) => { await p.locator('#btn-guide').click(); await p.getByRole('button', { name: 'Data', exact: true }).click(); await p.waitForTimeout(600) } })
await shot('07-solar-overview', { hash: '#solar=1', wait: 9000 })
await shot('08-saturn', { hash: '#body=saturn', wait: 9000 })
await shot('09-earth-in-solar', { hash: '#body=earth', wait: 9000, act: async (p) => {
  await p.evaluate(() => { const k = window.__kessler; k.solarMode.solar.startZoom(k.stage.solar.camera, 0.0006, 0.8) })
  await p.waitForTimeout(2500)
} })
await shot('10-mobile-earth', { viewport: { width: 390, height: 844 }, scale: 2, touch: true, wait: 4000 })
await shot('11-mobile-card', { hash: '#sat=25544', viewport: { width: 390, height: 844 }, scale: 2, touch: true, wait: 5000 })
await shot('12-mobile-saturn', { hash: '#body=saturn', viewport: { width: 390, height: 844 }, scale: 2, touch: true, wait: 9000 })
await shot('card', { viewport: { width: 1280, height: 800 }, wait: 4500 })
await browser.close()
