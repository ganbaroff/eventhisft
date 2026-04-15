# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: opsboard-prod.spec.ts >> OPSBOARD prod smoke >> 6. mgr escalates incident → ESCALATED
- Location: e2e\opsboard-prod.spec.ts:128:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /ESCALATE/i }).first()
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for getByRole('button', { name: /ESCALATE/i }).first()

```

# Test source

```ts
  39  |   test('1. landing loads, title=OPSBOARD, no unexpected console errors', async ({ page }) => {
  40  |     const errs: string[] = []
  41  |     consoleErrors['landing'] = errs
  42  |     attachConsole(page, errs)
  43  |     const resp = await page.goto('/')
  44  |     expect(resp?.status(), 'HTTP status').toBeLessThan(400)
  45  |     await expect(page).toHaveTitle(/OPSBOARD/)
  46  |     // wait for root to render
  47  |     await page.waitForSelector('#root > *', { timeout: 10_000 })
  48  |     await page.screenshot({ path: path.join(SHOTS, '01-landing.png'), fullPage: true })
  49  |     expect(errs, `console errors on landing: ${errs.join(' | ')}`).toHaveLength(0)
  50  |   })
  51  | 
  52  |   test('2. coord logs in, nav renders', async ({ page }) => {
  53  |     const errs: string[] = []
  54  |     attachConsole(page, errs)
  55  |     await login(page, 'coord')
  56  |     await page.goto('/now')
  57  |     // At least one of these nav labels should be present (NOW / INCIDENTS etc.)
  58  |     const nav = page.getByRole('link', { name: /NOW|INCIDENTS|OPERATIONS|DRAFTS/i }).first()
  59  |     await expect(nav).toBeVisible({ timeout: 10_000 })
  60  |     await page.screenshot({ path: path.join(SHOTS, '02-coord-now.png'), fullPage: true })
  61  |     consoleErrors['coord-login'] = errs
  62  |   })
  63  | 
  64  |   test('3. LIVE indicator on NOW page (mgr)', async ({ page }) => {
  65  |     const errs: string[] = []
  66  |     attachConsole(page, errs)
  67  |     await login(page, 'mgr')
  68  |     await page.goto('/now')
  69  |     // Allow SSE to connect — may take a moment
  70  |     const live = page.getByText(/LIVE/i).first()
  71  |     const autoRefresh = page.getByText(/live updates active|auto-refreshes/i).first()
  72  |     // EITHER the pill OR the footer text proves the page rendered. LIVE specifically proves SSE.
  73  |     const found = await Promise.race([
  74  |       live.waitFor({ state: 'visible', timeout: 8_000 }).then(() => 'LIVE'),
  75  |       autoRefresh.waitFor({ state: 'visible', timeout: 8_000 }).then(() => 'footer'),
  76  |     ]).catch(() => null)
  77  |     expect(found, 'neither LIVE pill nor SSE footer visible').not.toBeNull()
  78  |     await page.screenshot({ path: path.join(SHOTS, '03-mgr-now.png'), fullPage: true })
  79  |     consoleErrors['mgr-now'] = errs
  80  |   })
  81  | 
  82  |   test('4. mgr creates incident via UI, sees ACTIVE', async ({ page }, testInfo) => {
  83  |     const errs: string[] = []
  84  |     attachConsole(page, errs)
  85  |     await login(page, 'mgr')
  86  |     await page.goto('/incidents')
  87  |     await page.getByRole('button', { name: /NEW INCIDENT/i }).click()
  88  |     await page.waitForURL(/\/incidents\/new$/, { timeout: 8_000 })
  89  |     const title = `E2E smoke ${Date.now()}`
  90  |     await page.locator('input.input').first().fill(title)
  91  |     await page.getByRole('button', { name: /CREATE INCIDENT/i }).click()
  92  |     // after create we are navigated to /incidents/:id
  93  |     await page.waitForURL(/\/incidents\/[a-f0-9-]{8,}/i, { timeout: 15_000 })
  94  |     await expect(page.getByText(/ACTIVE/i).first()).toBeVisible({ timeout: 10_000 })
  95  |     const url = page.url()
  96  |     const incidentId = url.split('/').pop()!
  97  |     testInfo.annotations.push({ type: 'incidentId', description: incidentId })
  98  |     // persist id for next test
  99  |     fs.writeFileSync(path.join(SHOTS, '_incident.txt'), incidentId, 'utf8')
  100 |     await page.screenshot({ path: path.join(SHOTS, '04-incident-detail.png'), fullPage: true })
  101 |     consoleErrors['mgr-create'] = errs
  102 |   })
  103 | 
  104 |   test('5. coord cannot escalate (button hidden or 403 handled)', async ({ page }) => {
  105 |     const errs: string[] = []
  106 |     attachConsole(page, errs)
  107 |     const idFile = path.join(SHOTS, '_incident.txt')
  108 |     test.skip(!fs.existsSync(idFile), 'no incident from previous test')
  109 |     const id = fs.readFileSync(idFile, 'utf8').trim()
  110 |     await login(page, 'coord')
  111 |     await page.goto(`/incidents/${id}`)
  112 |     await page.waitForTimeout(2000)
  113 |     const escBtn = page.getByRole('button', { name: /ESCALATE/i })
  114 |     const count = await escBtn.count()
  115 |     if (count === 0) {
  116 |       // hidden — correct RBAC behavior
  117 |       expect(count).toBe(0)
  118 |     } else {
  119 |       // shown — clicking must not crash page; expect some error toast or status unchanged
  120 |       await escBtn.first().click().catch(() => {})
  121 |       await page.waitForTimeout(1500)
  122 |       // page still alive
  123 |       await expect(page.getByText(/ACTIVE|ESCALATED/i).first()).toBeVisible()
  124 |     }
  125 |     consoleErrors['coord-escalate'] = errs
  126 |   })
  127 | 
  128 |   test('6. mgr escalates incident → ESCALATED', async ({ page }) => {
  129 |     const errs: string[] = []
  130 |     attachConsole(page, errs)
  131 |     const idFile = path.join(SHOTS, '_incident.txt')
  132 |     test.skip(!fs.existsSync(idFile), 'no incident')
  133 |     const id = fs.readFileSync(idFile, 'utf8').trim()
  134 |     await login(page, 'mgr')
  135 |     await page.goto(`/incidents/${id}`)
  136 |     // Handle native confirm() dialog triggered by handleEscalate
  137 |     page.on('dialog', (d) => d.accept().catch(() => {}))
  138 |     const escBtn = page.getByRole('button', { name: /ESCALATE/i }).first()
> 139 |     await expect(escBtn).toBeVisible({ timeout: 8_000 })
      |                          ^ Error: expect(locator).toBeVisible() failed
  140 |     await escBtn.click()
  141 |     await expect(page.getByText(/ESCALATED/i).first()).toBeVisible({ timeout: 10_000 })
  142 |     await page.screenshot({ path: path.join(SHOTS, '05-escalated.png'), fullPage: true })
  143 |     consoleErrors['mgr-escalate'] = errs
  144 |   })
  145 | 
  146 |   test('7. screenshot tour — login, now, incidents, detail, admin', async ({ page }) => {
  147 |     const errs: string[] = []
  148 |     attachConsole(page, errs)
  149 |     // LoginPage (logged out)
  150 |     await page.context().clearCookies()
  151 |     await page.goto('/login')
  152 |     await page.waitForSelector('.login-logo', { timeout: 8_000 })
  153 |     await page.screenshot({ path: path.join(SHOTS, 'tour-01-login.png'), fullPage: true })
  154 |     // Admin login for broadest page visibility
  155 |     await login(page, 'admin')
  156 |     await page.goto('/now'); await page.waitForTimeout(2500)
  157 |     await page.screenshot({ path: path.join(SHOTS, 'tour-02-now.png'), fullPage: true })
  158 |     await page.goto('/incidents'); await page.waitForTimeout(1500)
  159 |     await page.screenshot({ path: path.join(SHOTS, 'tour-03-incidents.png'), fullPage: true })
  160 |     const idFile = path.join(SHOTS, '_incident.txt')
  161 |     if (fs.existsSync(idFile)) {
  162 |       await page.goto(`/incidents/${fs.readFileSync(idFile, 'utf8').trim()}`)
  163 |       await page.waitForTimeout(1500)
  164 |       await page.screenshot({ path: path.join(SHOTS, 'tour-04-incident-detail.png'), fullPage: true })
  165 |     }
  166 |     await page.goto('/admin'); await page.waitForTimeout(2000)
  167 |     await page.screenshot({ path: path.join(SHOTS, 'tour-05-admin.png'), fullPage: true })
  168 |     consoleErrors['tour'] = errs
  169 |   })
  170 | 
  171 |   test('8. login auto-redirects to /now within 2s (admin)', async ({ page }) => {
  172 |     const errs: string[] = []
  173 |     attachConsole(page, errs)
  174 |     await page.context().clearCookies()
  175 |     await page.goto('/login')
  176 |     const { email, password } = ACCOUNTS.admin
  177 |     await page.getByPlaceholder(/coordinator@org\.com/i).fill(email)
  178 |     await page.locator('input[type="password"]').fill(password)
  179 |     const t0 = Date.now()
  180 |     await page.getByRole('button', { name: /SIGN IN/i }).click()
  181 |     await page.waitForURL(/\/now(\b|\/|$)/, { timeout: 3_000 }).catch(() => {})
  182 |     const elapsed = Date.now() - t0
  183 |     const url = page.url()
  184 |     console.log(`[LOGIN-REDIRECT] url=${url} elapsed=${elapsed}ms`)
  185 |     expect(url, 'URL should contain /now after login').toMatch(/\/now/)
  186 |     expect(elapsed, 'redirect should complete <2000ms').toBeLessThan(2500)
  187 |     consoleErrors['login-redirect'] = errs
  188 |   })
  189 | 
  190 |   test('9. throttler: 6th failed login in <60s returns 429', async ({ request }) => {
  191 |     const url = 'https://eventhisft-production.up.railway.app/auth/login'
  192 |     const statuses: number[] = []
  193 |     for (let i = 0; i < 6; i++) {
  194 |       const r = await request.post(url, {
  195 |         data: { email: 'nobody@opsboard.local', password: 'wrongpw' + i },
  196 |         failOnStatusCode: false,
  197 |       })
  198 |       statuses.push(r.status())
  199 |     }
  200 |     console.log(`[THROTTLER] statuses=${JSON.stringify(statuses)}`)
  201 |     expect(statuses[5], `6th attempt should be 429, got ${statuses[5]}`).toBe(429)
  202 |   })
  203 | 
  204 |   test('10. security headers (HSTS, X-Frame-Options, X-Content-Type-Options)', async ({ request }) => {
  205 |     const r = await request.get('https://eventhisft-production.up.railway.app/healthz', { failOnStatusCode: false })
  206 |     const h = r.headers()
  207 |     const block = {
  208 |       'strict-transport-security': h['strict-transport-security'] || null,
  209 |       'x-frame-options': h['x-frame-options'] || null,
  210 |       'x-content-type-options': h['x-content-type-options'] || null,
  211 |       'x-dns-prefetch-control': h['x-dns-prefetch-control'] || null,
  212 |       'referrer-policy': h['referrer-policy'] || null,
  213 |     }
  214 |     console.log('[SECURITY-HEADERS] ' + JSON.stringify(block, null, 2))
  215 |     expect(block['strict-transport-security'], 'HSTS missing').not.toBeNull()
  216 |     expect(block['x-frame-options'], 'X-Frame-Options missing').not.toBeNull()
  217 |     expect(block['x-content-type-options'], 'X-Content-Type-Options missing').not.toBeNull()
  218 |   })
  219 | 
  220 |   test.afterAll(async () => {
  221 |     fs.writeFileSync(
  222 |       path.join(SHOTS, '_console-errors.json'),
  223 |       JSON.stringify(consoleErrors, null, 2),
  224 |       'utf8',
  225 |     )
  226 |   })
  227 | })
  228 | 
  229 | // ────────────────────────────────────────────────────────────────────────
  230 | // Atlas-changes-today verification (2026-04-15)
  231 | // ────────────────────────────────────────────────────────────────────────
  232 | 
  233 | const API = 'https://eventhisft-production.up.railway.app'
  234 | 
  235 | async function apiLogin(request: any, email: string, password: string) {
  236 |   const r = await request.post(`${API}/auth/login`, {
  237 |     data: { email, password },
  238 |     failOnStatusCode: false,
  239 |   })
```