import { expect, test, type Page } from '@playwright/test'

/** Skip the intro, and serve data from the bundled snapshot so the tests never depend on the network. */
async function open(page: Page, hash = ''): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('kessler.welcomed.v1', '1')
    localStorage.setItem('kessler.toured.v1', '1')
  })
  await page.route(/celestrak\.org|thespacedevs\.com/, (route) => route.abort())
  await page.goto(`/${hash}`)
  await expect(page.locator('.status')).toContainText('objects')
}

test('loads, shows the object count and the focus hint', async ({ page }) => {
  await open(page)
  await expect(page.locator('#gl')).toBeVisible()
  await expect(page.locator('.fb-hint')).toContainText(/dot/i)
})

test('search finds the ISS and its card explains what it is for', async ({ page }) => {
  await open(page)
  await page.locator('#btn-search').click()
  await page.getByRole('combobox', { name: 'Search' }).fill('iss (zarya)')
  await page.getByRole('option').first().click()
  await expect(page.locator('#card h2')).toContainText('ISS (ZARYA)')
  await expect(page.locator('.purpose')).toContainText(/space station/i)
  await expect(page).toHaveURL(/#sat=25544/)
})

test('filtering a fleet shows a focus bar with a working Clear button', async ({ page }) => {
  await open(page)
  await page.locator('#fleets .fleet').first().click()
  await expect(page.locator('.fb-pill')).toBeVisible()
  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.locator('.fb-pill')).toBeHidden()
})

test('the solar system opens on a deep link and shows real planet data', async ({ page }) => {
  await open(page, '#body=saturn')
  await expect(page.locator('#card h2')).toContainText('Saturn', { timeout: 60_000 })
  await expect(page.locator('#card')).toContainText('from the Sun')
  await page.getByRole('button', { name: '← Satellite view' }).click()
  await expect(page.locator('#fleets')).toBeVisible()
})

test('a deep link opens a NASA spacecraft with its distance from the Sun', async ({ page }) => {
  await open(page, '#body=voyager-1')
  await expect(page.locator('#card h2')).toContainText('Voyager 1', { timeout: 60_000 })
  await expect(page.locator('#card')).toContainText('NASA spacecraft')
  await expect(page.locator('#card')).toContainText('from the Sun')
})

test('comets are listed in the solar system nav and open with orbit facts', async ({ page }) => {
  await open(page, '#solar=1')
  await expect(page.getByRole('button', { name: 'Comets', exact: true })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Comets', exact: true }).click()
  await page.locator('#bodies .fleet', { hasText: '1P/Halley' }).click()
  await expect(page.locator('#card h2')).toContainText('1P/Halley')
  await expect(page.locator('#card')).toContainText('per orbit')
})

test('NASA has its own fleet of Earth satellites', async ({ page }) => {
  await open(page, '#fleet=nasa')
  await expect(page.locator('#card h2')).toContainText('NASA missions')
  await expect(page.locator('#card')).toContainText('Studying Earth')
})

test('the time menu jumps a day forward', async ({ page }) => {
  await open(page)
  const before = await page.locator('.clockbtn').innerText()
  await page.locator('.clockbtn').click()
  await page.getByRole('button', { name: '+1 day' }).click()
  await expect(page.locator('.clockbtn')).not.toHaveText(before)
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })
  test('the card becomes a bottom sheet with a handle', async ({ page }) => {
    await open(page, '#sat=25544')
    await expect(page.locator('#card .grab')).toBeVisible()
    await expect(page.locator('#card')).toHaveClass(/open/)
  })
  test('after filtering, the globe keeps its space: no filter pill, mode icon instead of the switch, peek card', async ({ page }) => {
    await open(page, '#fleet=spacex')
    await expect(page.locator('#modes')).toBeHidden()
    await expect(page.locator('#btn-mode')).toBeVisible()
    await expect(page.locator('#focusbar')).toBeHidden()
    const box = await page.locator('#card').boundingBox()
    expect(box!.height).toBeLessThan(200)
    await page.locator('#card .grab').click()
    await expect(page.locator('#card')).toHaveClass(/expanded/)
  })
})
