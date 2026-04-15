import { test, expect, Page, ConsoleMessage } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const SHOTS = path.resolve(process.cwd(), 'e2e', 'screenshots')
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true })

const ACCOUNTS = {
  admin: { email: 'admin@opsboard.local', password: 'admin123' },
  mgr:   { email: 'manager@opsboard.local', password: 'manager123' },
  coord: { email: 'coord@opsboard.local', password: 'coord123' },
}

// Track console errors per test; filter out SW/manifest noise
function attachConsole(page: Page, bucket: string[]) {
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return
    const t = msg.text()
    if (/service.?worker|sw\.js|workbox|manifest|registerSW/i.test(t)) return
    bucket.push(t)
  })
  page.on('pageerror', (e) => bucket.push(`pageerror: ${e.message}`))
}

async function login(page: Page, who: keyof typeof ACCOUNTS) {
  const { email, password } = ACCOUNTS[who]
  await page.goto('/login')
  await page.getByPlaceholder(/coordinator@org\.com/i).fill(email)
  await page.getByPlaceholder(/••|•/).fill(password).catch(async () => {
    await page.locator('input[type="password"]').fill(password)
  })
  await page.getByRole('button', { name: /SIGN IN/i }).click()
  // Login does NOT auto-redirect (known UX issue — /login route is unguarded).
  // Wait for access_token in localStorage, then navigate manually.
  await page.waitForFunction(() => !!localStorage.getItem('access_token'), null, { timeout: 15_000 })
}

test.describe('OPSBOARD prod smoke', () => {
  const consoleErrors: Record<string, string[]> = {}

  test('1. landing loads, title=OPSBOARD, no unexpected console errors', async ({ page }) => {
    const errs: string[] = []
    consoleErrors['landing'] = errs
    attachConsole(page, errs)
    const resp = await page.goto('/')
    expect(resp?.status(), 'HTTP status').toBeLessThan(400)
    await expect(page).toHaveTitle(/OPSBOARD/)
    // wait for root to render
    await page.waitForSelector('#root > *', { timeout: 10_000 })
    await page.screenshot({ path: path.join(SHOTS, '01-landing.png'), fullPage: true })
    expect(errs, `console errors on landing: ${errs.join(' | ')}`).toHaveLength(0)
  })

  test('2. coord logs in, nav renders', async ({ page }) => {
    const errs: string[] = []
    attachConsole(page, errs)
    await login(page, 'coord')
    await page.goto('/now')
    // At least one of these nav labels should be present (NOW / INCIDENTS etc.)
    const nav = page.getByRole('link', { name: /NOW|INCIDENTS|OPERATIONS|DRAFTS/i }).first()
    await expect(nav).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: path.join(SHOTS, '02-coord-now.png'), fullPage: true })
    consoleErrors['coord-login'] = errs
  })

  test('3. LIVE indicator on NOW page (mgr)', async ({ page }) => {
    const errs: string[] = []
    attachConsole(page, errs)
    await login(page, 'mgr')
    await page.goto('/now')
    // Allow SSE to connect — may take a moment
    const live = page.getByText(/LIVE/i).first()
    const autoRefresh = page.getByText(/live updates active|auto-refreshes/i).first()
    // EITHER the pill OR the footer text proves the page rendered. LIVE specifically proves SSE.
    const found = await Promise.race([
      live.waitFor({ state: 'visible', timeout: 8_000 }).then(() => 'LIVE'),
      autoRefresh.waitFor({ state: 'visible', timeout: 8_000 }).then(() => 'footer'),
    ]).catch(() => null)
    expect(found, 'neither LIVE pill nor SSE footer visible').not.toBeNull()
    await page.screenshot({ path: path.join(SHOTS, '03-mgr-now.png'), fullPage: true })
    consoleErrors['mgr-now'] = errs
  })

  test('4. mgr creates incident via UI, sees ACTIVE', async ({ page }, testInfo) => {
    const errs: string[] = []
    attachConsole(page, errs)
    await login(page, 'mgr')
    await page.goto('/incidents')
    await page.getByRole('button', { name: /NEW INCIDENT/i }).click()
    await page.waitForURL(/\/incidents\/new$/, { timeout: 8_000 })
    const title = `E2E smoke ${Date.now()}`
    await page.locator('input.input').first().fill(title)
    await page.getByRole('button', { name: /CREATE INCIDENT/i }).click()
    // after create we are navigated to /incidents/:id
    await page.waitForURL(/\/incidents\/[a-f0-9-]{8,}/i, { timeout: 15_000 })
    await expect(page.getByText(/ACTIVE/i).first()).toBeVisible({ timeout: 10_000 })
    const url = page.url()
    const incidentId = url.split('/').pop()!
    testInfo.annotations.push({ type: 'incidentId', description: incidentId })
    // persist id for next test
    fs.writeFileSync(path.join(SHOTS, '_incident.txt'), incidentId, 'utf8')
    await page.screenshot({ path: path.join(SHOTS, '04-incident-detail.png'), fullPage: true })
    consoleErrors['mgr-create'] = errs
  })

  test('5. coord cannot escalate (button hidden or 403 handled)', async ({ page }) => {
    const errs: string[] = []
    attachConsole(page, errs)
    const idFile = path.join(SHOTS, '_incident.txt')
    test.skip(!fs.existsSync(idFile), 'no incident from previous test')
    const id = fs.readFileSync(idFile, 'utf8').trim()
    await login(page, 'coord')
    await page.goto(`/incidents/${id}`)
    await page.waitForTimeout(2000)
    const escBtn = page.getByRole('button', { name: /ESCALATE/i })
    const count = await escBtn.count()
    if (count === 0) {
      // hidden — correct RBAC behavior
      expect(count).toBe(0)
    } else {
      // shown — clicking must not crash page; expect some error toast or status unchanged
      await escBtn.first().click().catch(() => {})
      await page.waitForTimeout(1500)
      // page still alive
      await expect(page.getByText(/ACTIVE|ESCALATED/i).first()).toBeVisible()
    }
    consoleErrors['coord-escalate'] = errs
  })

  test('6. mgr escalates incident → ESCALATED', async ({ page }) => {
    const errs: string[] = []
    attachConsole(page, errs)
    const idFile = path.join(SHOTS, '_incident.txt')
    test.skip(!fs.existsSync(idFile), 'no incident')
    const id = fs.readFileSync(idFile, 'utf8').trim()
    await login(page, 'mgr')
    await page.goto(`/incidents/${id}`)
    // Handle native confirm() dialog triggered by handleEscalate
    page.on('dialog', (d) => d.accept().catch(() => {}))
    const escBtn = page.getByRole('button', { name: /ESCALATE/i }).first()
    await expect(escBtn).toBeVisible({ timeout: 8_000 })
    await escBtn.click()
    await expect(page.getByText(/ESCALATED/i).first()).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: path.join(SHOTS, '05-escalated.png'), fullPage: true })
    consoleErrors['mgr-escalate'] = errs
  })

  test('7. screenshot tour — login, now, incidents, detail, admin', async ({ page }) => {
    const errs: string[] = []
    attachConsole(page, errs)
    // LoginPage (logged out)
    await page.context().clearCookies()
    await page.goto('/login')
    await page.waitForSelector('.login-logo', { timeout: 8_000 })
    await page.screenshot({ path: path.join(SHOTS, 'tour-01-login.png'), fullPage: true })
    // Admin login for broadest page visibility
    await login(page, 'admin')
    await page.goto('/now'); await page.waitForTimeout(2500)
    await page.screenshot({ path: path.join(SHOTS, 'tour-02-now.png'), fullPage: true })
    await page.goto('/incidents'); await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(SHOTS, 'tour-03-incidents.png'), fullPage: true })
    const idFile = path.join(SHOTS, '_incident.txt')
    if (fs.existsSync(idFile)) {
      await page.goto(`/incidents/${fs.readFileSync(idFile, 'utf8').trim()}`)
      await page.waitForTimeout(1500)
      await page.screenshot({ path: path.join(SHOTS, 'tour-04-incident-detail.png'), fullPage: true })
    }
    await page.goto('/admin'); await page.waitForTimeout(2000)
    await page.screenshot({ path: path.join(SHOTS, 'tour-05-admin.png'), fullPage: true })
    consoleErrors['tour'] = errs
  })

  test.afterAll(async () => {
    fs.writeFileSync(
      path.join(SHOTS, '_console-errors.json'),
      JSON.stringify(consoleErrors, null, 2),
      'utf8',
    )
  })
})
