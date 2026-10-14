// Records a short walkthrough of the running app using Chrome screencast frames and the system ffmpeg.
//   BASE=http://localhost:3096 node scripts/record.mjs
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:3096'
const W = 960
const H = 600
rmSync('docs/video', { recursive: true, force: true })
mkdirSync('docs/video/frames', { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: W, height: H } })
const page = await ctx.newPage()
await page.addInitScript(() => {
  localStorage.setItem('kessler.welcomed.v1', '1')
  localStorage.setItem('kessler.toured.v1', '1')
})
await page.route(/celestrak\.org/, (r) => r.abort())
await page.goto(`${BASE}/`)
await page.locator('.status').waitFor({ timeout: 90_000 })

const cdp = await ctx.newCDPSession(page)
const frames = []
cdp.on('Page.screencastFrame', async (f) => {
  frames.push({ t: f.metadata.timestamp, data: f.data })
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
})
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: W, maxHeight: H, everyNthFrame: 1 })

const hold = (ms) => page.waitForTimeout(ms)
await hold(3500)
await page.evaluate(() => { const k = window.__kessler; k.selectSat(k.sats.findIndex((s) => s.id === 25544)) })
await hold(4500)
await page.evaluate(() => window.__kessler.openFleet(1))
await hold(3500)
await page.getByRole('button', { name: 'Clear' }).click()
await hold(1200)
await page.getByRole('button', { name: 'Solar System' }).click()
await hold(9000)
await page.evaluate(() => window.__kessler.solarMode.focusBody('saturn'))
await hold(6000)
await page.evaluate(() => window.__kessler.solarMode.focusBody('jupiter'))
await hold(4500)
await cdp.send('Page.stopScreencast')
await browser.close()

// frame list with real durations, so playback matches wall-clock time even at an uneven frame rate
const lines = []
frames.forEach((f, i) => {
  const name = `docs/video/frames/${String(i).padStart(5, '0')}.jpg`
  writeFileSync(name, Buffer.from(f.data, 'base64'))
  const next = frames[i + 1]
  lines.push(`file '${process.cwd()}/${name}'`, `duration ${next ? Math.max(0.02, next.t - f.t).toFixed(3) : '0.5'}`)
})
lines.push(`file '${process.cwd()}/docs/video/frames/${String(frames.length - 1).padStart(5, '0')}.jpg'`)
writeFileSync('docs/video/list.txt', lines.join('\n'))
process.stdout.write(`frames: ${frames.length}\n`)
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'docs/video/list.txt', '-vf', `fps=24,scale=${W}:${H}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', 'docs/video/kessler.mp4'])
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', 'docs/video/kessler.mp4', '-frames:v', '1', 'docs/video/kessler-poster.jpg'])
process.stdout.write('done\n')
