import { defineConfig } from '@playwright/test'

// Uses the Chrome already installed on the machine, so no browser download is needed.
// Run locally: npm run test:e2e   (needs `npm run snapshot` once so the app has data without the network)
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 45_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: { command: 'npm run dev -- --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 60_000 },
})
