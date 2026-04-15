# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: opsboard-prod.spec.ts >> Atlas 2026-04-15 deltas >> A2. manager forced-rotation flow (rotates + rotates back)
- Location: e2e\opsboard-prod.spec.ts:259:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/INCIDENTS/i).first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText(/INCIDENTS/i).first()

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e6]: OPSBOARD
    - generic [ref=e7]: operational source of truth
  - generic [ref=e8]:
    - generic [ref=e9]:
      - generic [ref=e10]: Email
      - textbox "coordinator@org.com" [active] [ref=e11]
    - generic [ref=e12]:
      - generic [ref=e13]: Password
      - textbox "••••••••" [ref=e14]
  - button "SIGN IN →" [disabled] [ref=e15]
  - generic [ref=e16]: OPSBOARD · SECURE ACCESS
```

# Test source

```ts
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
  240 |   return { status: r.status(), body: r.status() < 400 ? await r.json() : null }
  241 | }
  242 | 
  243 | test.describe('Atlas 2026-04-15 deltas', () => {
  244 |   test('A1. admin /now loads, /context 200', async ({ page, request }) => {
  245 |     await login(page, 'admin')
  246 |     await page.goto('/now')
  247 |     await expect(page.getByRole('link', { name: /NOW/i }).first()).toBeVisible({ timeout: 10_000 })
  248 |     const token = await page.evaluate(() => localStorage.getItem('access_token'))
  249 |     const r = await request.get(`${API}/context`, {
  250 |       headers: { Authorization: `Bearer ${token}` },
  251 |       failOnStatusCode: false,
  252 |     })
  253 |     expect(r.status()).toBe(200)
  254 |     const body = await r.json()
  255 |     expect(body.user.email).toBe('admin@opsboard.local')
  256 |     await page.screenshot({ path: path.join(SHOTS, 'A1-admin-now.png'), fullPage: true })
  257 |   })
  258 | 
  259 |   test('A2. manager forced-rotation flow (rotates + rotates back)', async ({ page, request }) => {
  260 |     const original = 'TyncmjpzdrRH'
  261 |     const temp = 'Temp-' + Date.now() + '!A'
  262 |     await login(page, 'mgr')
  263 |     // ChangePasswordModal should auto-open, forced (no close button, no cancel)
  264 |     const modalTitle = page.getByText(/CHANGE PASSWORD/i).first()
  265 |     await expect(modalTitle).toBeVisible({ timeout: 10_000 })
  266 |     // Close (✕) button is hidden when forced
  267 |     const closeBtns = await page.getByRole('button', { name: /^Close$/i }).count()
  268 |     expect(closeBtns, 'forced modal must not expose Close').toBe(0)
  269 |     const cancelBtns = await page.getByRole('button', { name: /^CANCEL$/i }).count()
  270 |     expect(cancelBtns, 'forced modal must not expose Cancel').toBe(0)
  271 |     // Overlay click must not dismiss
  272 |     await page.locator('.modal-overlay').click({ position: { x: 10, y: 10 } }).catch(() => {})
  273 |     await expect(modalTitle).toBeVisible()
  274 |     await page.screenshot({ path: path.join(SHOTS, 'A2-mgr-forced-modal.png'), fullPage: true })
  275 |     // Submit new password
  276 |     const inputs = page.locator('.modal-card input[type="password"]')
  277 |     await inputs.nth(0).fill(original)
  278 |     await inputs.nth(1).fill(temp)
  279 |     await inputs.nth(2).fill(temp)
  280 |     await page.getByRole('button', { name: /SAVE PASSWORD/i }).click()
  281 |     await expect(modalTitle).toBeHidden({ timeout: 10_000 })
  282 |     // Navigate to /incidents (proves session usable)
  283 |     await page.goto('/incidents')
> 284 |     await expect(page.getByText(/INCIDENTS/i).first()).toBeVisible({ timeout: 10_000 })
      |                                                        ^ Error: expect(locator).toBeVisible() failed
  285 |     // Rotate back via API (fresh login at temp, change to original)
  286 |     const loginTemp = await apiLogin(request, 'manager@opsboard.local', temp)
  287 |     expect(loginTemp.status, 'login with temp must succeed').toBe(200)
  288 |     const rot = await request.patch(`${API}/auth/password`, {
  289 |       headers: { Authorization: `Bearer ${loginTemp.body.accessToken}` },
  290 |       data: { currentPassword: temp, newPassword: original },
  291 |       failOnStatusCode: false,
  292 |     })
  293 |     expect(rot.status(), 'rotate-back must succeed').toBeLessThan(400)
  294 |   })
  295 | 
  296 |   test('A3. coord forced-rotation flow (rotates + rotates back)', async ({ page, request }) => {
  297 |     const original = 'JsLCjCXvGmk'
  298 |     const temp = 'Temp-' + Date.now() + '!B'
  299 |     await login(page, 'coord')
  300 |     const modalTitle = page.getByText(/CHANGE PASSWORD/i).first()
  301 |     await expect(modalTitle).toBeVisible({ timeout: 10_000 })
  302 |     expect(await page.getByRole('button', { name: /^Close$/i }).count()).toBe(0)
  303 |     expect(await page.getByRole('button', { name: /^CANCEL$/i }).count()).toBe(0)
  304 |     const inputs = page.locator('.modal-card input[type="password"]')
  305 |     await inputs.nth(0).fill(original)
  306 |     await inputs.nth(1).fill(temp)
  307 |     await inputs.nth(2).fill(temp)
  308 |     await page.getByRole('button', { name: /SAVE PASSWORD/i }).click()
  309 |     await expect(modalTitle).toBeHidden({ timeout: 10_000 })
  310 |     await page.goto('/incidents')
  311 |     await expect(page.getByText(/INCIDENTS/i).first()).toBeVisible({ timeout: 10_000 })
  312 |     // Rotate back
  313 |     const loginTemp = await apiLogin(request, 'coord@opsboard.local', temp)
  314 |     expect(loginTemp.status).toBe(200)
  315 |     const rot = await request.patch(`${API}/auth/password`, {
  316 |       headers: { Authorization: `Bearer ${loginTemp.body.accessToken}` },
  317 |       data: { currentPassword: temp, newPassword: original },
  318 |       failOnStatusCode: false,
  319 |     })
  320 |     expect(rot.status()).toBeLessThan(400)
  321 |   })
  322 | 
  323 |   test('A4. tokenVersion revokes old access token after password change', async ({ request }) => {
  324 |     // Use admin (mustChangePassword=false, can rotate self without forced UX)
  325 |     const original = 'cDWrVrkSs1'
  326 |     const temp = 'Temp-' + Date.now() + '!C'
  327 |     const l1 = await apiLogin(request, 'admin@opsboard.local', original)
  328 |     test.skip(l1.status !== 200, `admin login failed: ${l1.status}`)
  329 |     const T1 = l1.body.accessToken
  330 |     // Verify T1 works
  331 |     const c1 = await request.get(`${API}/context`, {
  332 |       headers: { Authorization: `Bearer ${T1}` }, failOnStatusCode: false,
  333 |     })
  334 |     expect(c1.status()).toBe(200)
  335 |     // Change password using T1
  336 |     const ch = await request.patch(`${API}/auth/password`, {
  337 |       headers: { Authorization: `Bearer ${T1}` },
  338 |       data: { currentPassword: original, newPassword: temp },
  339 |       failOnStatusCode: false,
  340 |     })
  341 |     expect(ch.status(), 'change-password must succeed').toBeLessThan(400)
  342 |     // T1 now must be revoked
  343 |     const c2 = await request.get(`${API}/context`, {
  344 |       headers: { Authorization: `Bearer ${T1}` }, failOnStatusCode: false,
  345 |     })
  346 |     expect(c2.status(), 'old T1 must be 401 after tv bump').toBe(401)
  347 |     // Rotate password BACK so admin cred in spec stays valid
  348 |     const l2 = await apiLogin(request, 'admin@opsboard.local', temp)
  349 |     expect(l2.status, 'login with temp pw must succeed').toBe(200)
  350 |     const rb = await request.patch(`${API}/auth/password`, {
  351 |       headers: { Authorization: `Bearer ${l2.body.accessToken}` },
  352 |       data: { currentPassword: temp, newPassword: original },
  353 |       failOnStatusCode: false,
  354 |     })
  355 |     expect(rb.status(), 'rotate-back must succeed').toBeLessThan(400)
  356 |   })
  357 | 
  358 |   test('A5. SSE ticket: /sse/now rejects access token, accepts ticket', async ({ request }) => {
  359 |     const l = await apiLogin(request, 'admin@opsboard.local', 'cDWrVrkSs1')
  360 |     test.skip(l.status !== 200, `admin login failed: ${l.status}`)
  361 |     const access = l.body.accessToken
  362 |     // Get ticket
  363 |     const tk = await request.post(`${API}/auth/sse-ticket`, {
  364 |       headers: { Authorization: `Bearer ${access}` }, failOnStatusCode: false,
  365 |     })
  366 |     expect([200, 201]).toContain(tk.status())
  367 |     const body = await tk.json()
  368 |     expect(body.ticket, 'ticket field present').toBeTruthy()
  369 |     // Access token in URL must be rejected on /sse/now
  370 |     const bad = await request.get(`${API}/sse/now?token=${encodeURIComponent(access)}`, {
  371 |       failOnStatusCode: false,
  372 |       timeout: 5000,
  373 |     }).catch((e) => ({ status: () => 0, _err: e.message }))
  374 |     // Note: SSE may hang — we use a short timeout. 401 is the expected contract.
  375 |     const badStatus = (bad as any).status()
  376 |     expect(badStatus, `sse/now with access token got ${badStatus}`).toBe(401)
  377 |     // Ticket must stream event. We just verify 200 + correct content-type (stream will stay open).
  378 |     const good = await request.get(`${API}/sse/now?token=${encodeURIComponent(body.ticket)}`, {
  379 |       failOnStatusCode: false,
  380 |       timeout: 3000,
  381 |     }).catch(() => null)
  382 |     if (good) {
  383 |       expect(good.status()).toBe(200)
  384 |       const ct = good.headers()['content-type'] || ''
```