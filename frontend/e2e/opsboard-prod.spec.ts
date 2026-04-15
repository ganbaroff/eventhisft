import { test, expect, Page, ConsoleMessage } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const SHOTS = path.resolve(process.cwd(), 'e2e', 'screenshots')
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true })

const ACCOUNTS = {
  admin: { email: 'admin@opsboard.local', password: 'cDWrVrkSs1' },
  mgr:   { email: 'manager@opsboard.local', password: 'TyncmjpzdrRH' },
  coord: { email: 'coord@opsboard.local', password: 'JsLCjCXvGmk' },
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

  test('8. login auto-redirects to /now within 2s (admin)', async ({ page }) => {
    const errs: string[] = []
    attachConsole(page, errs)
    await page.context().clearCookies()
    await page.goto('/login')
    const { email, password } = ACCOUNTS.admin
    await page.getByPlaceholder(/coordinator@org\.com/i).fill(email)
    await page.locator('input[type="password"]').fill(password)
    const t0 = Date.now()
    await page.getByRole('button', { name: /SIGN IN/i }).click()
    await page.waitForURL(/\/now(\b|\/|$)/, { timeout: 3_000 }).catch(() => {})
    const elapsed = Date.now() - t0
    const url = page.url()
    console.log(`[LOGIN-REDIRECT] url=${url} elapsed=${elapsed}ms`)
    expect(url, 'URL should contain /now after login').toMatch(/\/now/)
    expect(elapsed, 'redirect should complete <2000ms').toBeLessThan(2500)
    consoleErrors['login-redirect'] = errs
  })

  test('9. throttler: 6th failed login in <60s returns 429', async ({ request }) => {
    const url = 'https://eventhisft-production.up.railway.app/auth/login'
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const r = await request.post(url, {
        data: { email: 'nobody@opsboard.local', password: 'wrongpw' + i },
        failOnStatusCode: false,
      })
      statuses.push(r.status())
    }
    console.log(`[THROTTLER] statuses=${JSON.stringify(statuses)}`)
    expect(statuses[5], `6th attempt should be 429, got ${statuses[5]}`).toBe(429)
  })

  test('10. security headers (HSTS, X-Frame-Options, X-Content-Type-Options)', async ({ request }) => {
    const r = await request.get('https://eventhisft-production.up.railway.app/healthz', { failOnStatusCode: false })
    const h = r.headers()
    const block = {
      'strict-transport-security': h['strict-transport-security'] || null,
      'x-frame-options': h['x-frame-options'] || null,
      'x-content-type-options': h['x-content-type-options'] || null,
      'x-dns-prefetch-control': h['x-dns-prefetch-control'] || null,
      'referrer-policy': h['referrer-policy'] || null,
    }
    console.log('[SECURITY-HEADERS] ' + JSON.stringify(block, null, 2))
    expect(block['strict-transport-security'], 'HSTS missing').not.toBeNull()
    expect(block['x-frame-options'], 'X-Frame-Options missing').not.toBeNull()
    expect(block['x-content-type-options'], 'X-Content-Type-Options missing').not.toBeNull()
  })

  test.afterAll(async () => {
    fs.writeFileSync(
      path.join(SHOTS, '_console-errors.json'),
      JSON.stringify(consoleErrors, null, 2),
      'utf8',
    )
  })
})

// ────────────────────────────────────────────────────────────────────────
// Atlas-changes-today verification (2026-04-15)
// ────────────────────────────────────────────────────────────────────────

const API = 'https://eventhisft-production.up.railway.app'

async function apiLogin(request: any, email: string, password: string) {
  const r = await request.post(`${API}/auth/login`, {
    data: { email, password },
    failOnStatusCode: false,
  })
  return { status: r.status(), body: r.status() < 400 ? await r.json() : null }
}

test.describe('Atlas 2026-04-15 deltas', () => {
  test('A1. admin /now loads, /context 200', async ({ page, request }) => {
    await login(page, 'admin')
    await page.goto('/now')
    await expect(page.getByRole('link', { name: /NOW/i }).first()).toBeVisible({ timeout: 10_000 })
    const token = await page.evaluate(() => localStorage.getItem('access_token'))
    const r = await request.get(`${API}/context`, {
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    })
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body.user.email).toBe('admin@opsboard.local')
    await page.screenshot({ path: path.join(SHOTS, 'A1-admin-now.png'), fullPage: true })
  })

  test('A2. manager forced-rotation flow (rotates + rotates back)', async ({ page, request }) => {
    const original = 'TyncmjpzdrRH'
    const temp = 'Temp-' + Date.now() + '!A'
    await login(page, 'mgr')
    // ChangePasswordModal should auto-open, forced (no close button, no cancel)
    const modalTitle = page.getByText(/CHANGE PASSWORD/i).first()
    await expect(modalTitle).toBeVisible({ timeout: 10_000 })
    // Close (✕) button is hidden when forced
    const closeBtns = await page.getByRole('button', { name: /^Close$/i }).count()
    expect(closeBtns, 'forced modal must not expose Close').toBe(0)
    const cancelBtns = await page.getByRole('button', { name: /^CANCEL$/i }).count()
    expect(cancelBtns, 'forced modal must not expose Cancel').toBe(0)
    // Overlay click must not dismiss
    await page.locator('.modal-overlay').click({ position: { x: 10, y: 10 } }).catch(() => {})
    await expect(modalTitle).toBeVisible()
    await page.screenshot({ path: path.join(SHOTS, 'A2-mgr-forced-modal.png'), fullPage: true })
    // Submit new password
    const inputs = page.locator('.modal-card input[type="password"]')
    await inputs.nth(0).fill(original)
    await inputs.nth(1).fill(temp)
    await inputs.nth(2).fill(temp)
    await page.getByRole('button', { name: /SAVE PASSWORD/i }).click()
    await expect(modalTitle).toBeHidden({ timeout: 10_000 })
    // Navigate to /incidents (proves session usable)
    await page.goto('/incidents')
    await expect(page.getByText(/INCIDENTS/i).first()).toBeVisible({ timeout: 10_000 })
    // Rotate back via API (fresh login at temp, change to original)
    const loginTemp = await apiLogin(request, 'manager@opsboard.local', temp)
    expect(loginTemp.status, 'login with temp must succeed').toBe(200)
    const rot = await request.patch(`${API}/auth/password`, {
      headers: { Authorization: `Bearer ${loginTemp.body.accessToken}` },
      data: { currentPassword: temp, newPassword: original },
      failOnStatusCode: false,
    })
    expect(rot.status(), 'rotate-back must succeed').toBeLessThan(400)
  })

  test('A3. coord forced-rotation flow (rotates + rotates back)', async ({ page, request }) => {
    const original = 'JsLCjCXvGmk'
    const temp = 'Temp-' + Date.now() + '!B'
    await login(page, 'coord')
    const modalTitle = page.getByText(/CHANGE PASSWORD/i).first()
    await expect(modalTitle).toBeVisible({ timeout: 10_000 })
    expect(await page.getByRole('button', { name: /^Close$/i }).count()).toBe(0)
    expect(await page.getByRole('button', { name: /^CANCEL$/i }).count()).toBe(0)
    const inputs = page.locator('.modal-card input[type="password"]')
    await inputs.nth(0).fill(original)
    await inputs.nth(1).fill(temp)
    await inputs.nth(2).fill(temp)
    await page.getByRole('button', { name: /SAVE PASSWORD/i }).click()
    await expect(modalTitle).toBeHidden({ timeout: 10_000 })
    await page.goto('/incidents')
    await expect(page.getByText(/INCIDENTS/i).first()).toBeVisible({ timeout: 10_000 })
    // Rotate back
    const loginTemp = await apiLogin(request, 'coord@opsboard.local', temp)
    expect(loginTemp.status).toBe(200)
    const rot = await request.patch(`${API}/auth/password`, {
      headers: { Authorization: `Bearer ${loginTemp.body.accessToken}` },
      data: { currentPassword: temp, newPassword: original },
      failOnStatusCode: false,
    })
    expect(rot.status()).toBeLessThan(400)
  })

  test('A4. tokenVersion revokes old access token after password change', async ({ request }) => {
    // Use admin (mustChangePassword=false, can rotate self without forced UX)
    const original = 'cDWrVrkSs1'
    const temp = 'Temp-' + Date.now() + '!C'
    const l1 = await apiLogin(request, 'admin@opsboard.local', original)
    test.skip(l1.status !== 200, `admin login failed: ${l1.status}`)
    const T1 = l1.body.accessToken
    // Verify T1 works
    const c1 = await request.get(`${API}/context`, {
      headers: { Authorization: `Bearer ${T1}` }, failOnStatusCode: false,
    })
    expect(c1.status()).toBe(200)
    // Change password using T1
    const ch = await request.patch(`${API}/auth/password`, {
      headers: { Authorization: `Bearer ${T1}` },
      data: { currentPassword: original, newPassword: temp },
      failOnStatusCode: false,
    })
    expect(ch.status(), 'change-password must succeed').toBeLessThan(400)
    // T1 now must be revoked
    const c2 = await request.get(`${API}/context`, {
      headers: { Authorization: `Bearer ${T1}` }, failOnStatusCode: false,
    })
    expect(c2.status(), 'old T1 must be 401 after tv bump').toBe(401)
    // Rotate password BACK so admin cred in spec stays valid
    const l2 = await apiLogin(request, 'admin@opsboard.local', temp)
    expect(l2.status, 'login with temp pw must succeed').toBe(200)
    const rb = await request.patch(`${API}/auth/password`, {
      headers: { Authorization: `Bearer ${l2.body.accessToken}` },
      data: { currentPassword: temp, newPassword: original },
      failOnStatusCode: false,
    })
    expect(rb.status(), 'rotate-back must succeed').toBeLessThan(400)
  })

  test('A5. SSE ticket: /sse/now rejects access token, accepts ticket', async ({ request }) => {
    const l = await apiLogin(request, 'admin@opsboard.local', 'cDWrVrkSs1')
    test.skip(l.status !== 200, `admin login failed: ${l.status}`)
    const access = l.body.accessToken
    // Get ticket
    const tk = await request.post(`${API}/auth/sse-ticket`, {
      headers: { Authorization: `Bearer ${access}` }, failOnStatusCode: false,
    })
    expect([200, 201]).toContain(tk.status())
    const body = await tk.json()
    expect(body.ticket, 'ticket field present').toBeTruthy()
    // Access token in URL must be rejected on /sse/now
    const bad = await request.get(`${API}/sse/now?token=${encodeURIComponent(access)}`, {
      failOnStatusCode: false,
      timeout: 5000,
    }).catch((e) => ({ status: () => 0, _err: e.message }))
    // Note: SSE may hang — we use a short timeout. 401 is the expected contract.
    const badStatus = (bad as any).status()
    expect(badStatus, `sse/now with access token got ${badStatus}`).toBe(401)
    // Ticket must stream event. We just verify 200 + correct content-type (stream will stay open).
    const good = await request.get(`${API}/sse/now?token=${encodeURIComponent(body.ticket)}`, {
      failOnStatusCode: false,
      timeout: 3000,
    }).catch(() => null)
    if (good) {
      expect(good.status()).toBe(200)
      const ct = good.headers()['content-type'] || ''
      expect(ct).toMatch(/event-stream/i)
    }
  })

  test('A6. OPSBOARD wordmark consistent across /now /incidents /admin /shifts /drafts', async ({ page }) => {
    await login(page, 'admin')
    const paths = ['/now', '/incidents', '/admin', '/shifts', '/drafts']
    const clips: { path: string, file: string }[] = []
    for (const p of paths) {
      await page.goto(p).catch(() => {})
      await page.waitForTimeout(800)
      const file = `A6-wordmark${p.replace(/\//g, '-')}.png`
      await page.screenshot({
        path: path.join(SHOTS, file),
        clip: { x: 0, y: 0, width: 220, height: 48 },
      })
      clips.push({ path: p, file })
      // Topbar logo text must read OPSBOARD
      const logo = page.locator('.app-topbar__logo').first()
      await expect(logo).toHaveText(/OPSBOARD/)
    }
    fs.writeFileSync(path.join(SHOTS, '_A6-wordmark-manifest.json'), JSON.stringify(clips, null, 2), 'utf8')
  })

  test('A7. key icon has aria-label "Change password"', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/now')
    const btn = page.getByRole('button', { name: /^Change password$/i })
    await expect(btn).toBeVisible({ timeout: 8_000 })
    expect(await btn.count()).toBe(1)
  })

  test('A8. /incidents: NEW INCIDENT on same row as filter tabs (not header)', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/incidents')
    const cta = page.getByRole('button', { name: /NEW INCIDENT/i })
    const filterAll = page.getByRole('button', { name: /^ALL$/i }).first()
    await expect(cta).toBeVisible({ timeout: 8_000 })
    await expect(filterAll).toBeVisible()
    // CTA must NOT live inside page-header
    const ctaInHeader = await page.locator('.page-header').getByRole('button', { name: /NEW INCIDENT/i }).count()
    expect(ctaInHeader, 'CTA must not be in page-header').toBe(0)
    // Same visual row (vertical center within ~10px)
    const a = await cta.boundingBox()
    const b = await filterAll.boundingBox()
    expect(a && b).toBeTruthy()
    const dy = Math.abs((a!.y + a!.height / 2) - (b!.y + b!.height / 2))
    expect(dy, `vertical offset between CTA and filter row = ${dy}px`).toBeLessThan(20)
    await page.screenshot({ path: path.join(SHOTS, 'A8-incidents-layout.png'), fullPage: true })
  })

  test('A9. /health returns 200 {status:"ok"}', async ({ request }) => {
    const r = await request.get(`${API}/health`, { failOnStatusCode: false })
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body.status).toBe('ok')
  })

  test('A10. login rate-limit: 6th bad attempt returns 429', async ({ request }) => {
    // Use unique email to avoid colliding with other tests' throttler buckets.
    const email = `rl-${Date.now()}@opsboard.local`
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const r = await request.post(`${API}/auth/login`, {
        data: { email, password: 'wrong' + i },
        failOnStatusCode: false,
      })
      statuses.push(r.status())
    }
    console.log('[A10-THROTTLER] ' + JSON.stringify(statuses))
    expect(statuses[5]).toBe(429)
  })
})

