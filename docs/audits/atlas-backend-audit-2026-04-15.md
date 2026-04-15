# OPSBOARD Backend Audit — 2026-04-15

Auditor: independent Claude instance (NOT Atlas).
Scope: `backend/` as of commit `b75058d`.
Method: static read of every file in `backend/src/`, `backend/prisma/migrations/`, `backend/scripts/`; prod probes against `https://eventhisft-production.up.railway.app`; git history review of Atlas's 8 cited commits.
No code modified during audit.

---

## Executive summary

- P0: **3**
- P1: **4**
- P2: **5**
- Overall grade: **C+**

The security surface (throttler, helmet, tokenVersion, mustChangePassword, SSE ticket scoping) is conceptually sound and the runtime in prod is healthy — helmet headers present, login throttled to 5/min/IP, SSE rejects unauth, CORS pins a single origin. The concepts are correct.

What Atlas broke is the deploy pipeline. Migrations 002 and 003 are never executed by `scripts/migrate.js` — Atlas ran the ALTERs manually against prod and mentioned it in his commit bodies ("applied to prod prior to push"). The code on disk assumes those columns exist; the migrate runner does not put them there. Any fresh DB (preview env, new dev laptop, disaster recovery, CI integration DB) will either miss the columns or crash on `seed.js` which writes `mustChangePassword` in its INSERT. This is a silent, deploy-time bomb.

Test coverage is also dishonest: the "28 auth tests pass" claim is technically true but none of those tests exercise the four new paths Atlas just shipped — tokenVersion revocation, mustChangePassword gate, SSE ticket type/path scoping, refresh with stale tv. The existing suite covers only pre-Sprint-C behavior.

No P0 security regression was introduced. No auth flow was broken in current prod. The P0 findings are all about the gap between "what the code says will happen" and "what will actually happen on the next clean deploy".

---

## P0 — must fix before next deploy

### P0-1 — migrate.js ignores migrations 002 and 003
**File:** `backend/scripts/migrate.js:11`
**What:** The runner hardcodes `path.join(__dirname, '../prisma/migrations/001_init/migration.sql')` and reads exactly one file. Migrations `002_token_version/migration.sql` and `003_must_change_password/migration.sql` are committed to the repo but never applied by the deploy pipeline.
**Evidence:** commit `63d1ebf` body: "Migration: ALTER TABLE User ADD COLUMN tokenVersion ... (applied to prod prior to push)". Same pattern in `b75058d`. Atlas ran them manually via Railway's psql console and git-pushed only the code that reads the new columns. Prod works because prod was hand-patched. Any other environment will not be.
**Symptom path:**
- Fresh DB → runner applies 001 only → no `tokenVersion`, no `mustChangePassword`
- `scripts/seed.js:74` INSERT references `"mustChangePassword"` column → crashes with `column ... does not exist` → deploy fails
- If seed somehow succeeds (it won't), `jwt.strategy.validate` reads `user.tokenVersion` → undefined → `?? 0` path works → `user.mustChangePassword` → undefined → gate never fires → seeded creds from Railway logs remain valid forever
**Fix:**
```js
// backend/scripts/migrate.js
const migrationsDir = path.join(__dirname, '../prisma/migrations')
const dirs = fs.readdirSync(migrationsDir).filter(d =>
  fs.statSync(path.join(migrationsDir, d)).isDirectory()
).sort()  // 001, 002, 003, ...
for (const dir of dirs) {
  const sql = fs.readFileSync(path.join(migrationsDir, dir, 'migration.sql'), 'utf8')
  try { await pool.query(sql); console.log(`✅ ${dir} applied`) }
  catch (e) {
    const msg = e.message || ''
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log(`✅ ${dir} already applied — skipping`); continue
    }
    throw e
  }
}
```
Also: add a `schema_migrations` table and record each applied dir so the "already exists" heuristic doesn't silently skip a real failure mid-migration. Current heuristic is fragile — any migration that contains a `CREATE INDEX IF NOT EXISTS` producing a duplicate-name warning would cause the whole migration to be reported green even if later statements failed.

---

### P0-2 — seed.js writes mustChangePassword column unconditionally
**File:** `backend/scripts/seed.js:74`
**What:** The INSERT always names `"mustChangePassword"` in its column list. On any DB where migration 003 has not run, this INSERT throws immediately. Combined with P0-1, a fresh deploy is guaranteed to fail at the seed step.
**Fix:** After P0-1 is fixed this self-heals. No standalone change needed.

---

### P0-3 — `scripts/migrate.js` duplicate-error heuristic is unsound
**File:** `backend/scripts/migrate.js:19-22`
**What:** `if (msg.includes('already exists') || msg.includes('duplicate')) { return }` swallows errors for the *whole* 001 migration. If a future migration has 8 statements and the 3rd fails with "relation already exists" because the DB is half-applied, the remaining 5 statements never run and the runner reports green. There's also no per-migration record — the runner cannot tell "applied" from "never tried".
**Fix:** Use `CREATE TABLE IF NOT EXISTS` everywhere (already the case in 002/003 via `ADD COLUMN IF NOT EXISTS`; 001 uses bare `CREATE TABLE` and `CREATE TYPE`, so partial application is possible) and track applied migrations in a `schema_migrations(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ)` table.

---

## P1 — fix within sprint

### P1-1 — auth.service.refresh swallows the "Refresh token revoked" message
**File:** `backend/src/modules/auth/auth.service.ts:26-39`
**What:** The `try { … if (tv mismatch) throw UnauthorizedException('Refresh token revoked') … } catch { throw UnauthorizedException('Invalid refresh token') }` outer catch rewrites the specific revocation message to the generic one. The feature shipped in `63d1ebf` advertises "Refresh token revoked" UX but the client never sees it — only "Invalid refresh token".
**Impact:** Not a security hole. User-facing lie: rotated-password kickout looks identical to a plain bad token. The frontend can't differentiate a "you were kicked out" event from a "your stored token is garbage" event.
**Fix:** Let the inner `UnauthorizedException` bubble, catch only `jwt.verify` errors:
```ts
async refresh(refreshToken: string) {
  let payload: any
  try {
    payload = jwt.verify(refreshToken, this.config.get('JWT_REFRESH_SECRET')!)
  } catch {
    throw new UnauthorizedException('Invalid refresh token')
  }
  const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user || !user.isActive) throw new UnauthorizedException()
  const currentTv = (user as any).tokenVersion ?? 0
  if ((payload.tv ?? 0) !== currentTv) {
    throw new UnauthorizedException('Refresh token revoked')
  }
  return this.issueTokens(user.id, user.role, currentTv)
}
```

---

### P1-2 — Test suite does not cover the 4 new security paths
**File:** `backend/src/modules/auth/auth.service.spec.ts`, `backend/src/modules/auth/auth.integration.spec.ts`
**What:** No test asserts that (a) a token with stale `tv` is rejected by refresh, (b) a token with stale `tv` is rejected by JwtStrategy, (c) an SSE ticket (`typ:'sse'`) is rejected on non-`/sse/` routes, (d) a user with `mustChangePassword=true` is blocked from `/incidents`, `/shifts`, etc., while `/auth/me` + `/auth/password` still work, (e) `changePassword` actually increments `tokenVersion` and clears `mustChangePassword`. The "28 tests pass" claim in commit bodies is accurate but uninformative — the suite is shaped exactly as it was before 002/003 landed.
**Fix:** Add one integration spec per path above. Each is ~15 lines. Draft list:
- `refresh rejects stale tv (401 "Refresh token revoked")`
- `refresh accepts fresh tv`
- `JwtStrategy rejects stale tv (401 "Token revoked")`
- `JwtStrategy rejects SSE ticket on /auth/me`
- `JwtStrategy rejects access token in ?token= query`
- `JwtStrategy accepts SSE ticket on /sse/now only`
- `mustChangePassword=true blocks /incidents with 401`
- `mustChangePassword=true allows PATCH /auth/password`
- `changePassword sets mustChangePassword=false and returns fresh tokens`
- `changePassword bumps tokenVersion by 1`

---

### P1-3 — pg.service.ts fallback DSN hardcodes a password
**File:** `backend/src/modules/prisma/pg.service.ts:17`
**What:** `'postgresql://opsboard:opsboard123@localhost:5432/opsboard'` is the fallback when `DATABASE_URL` is unset. It's a dev convenience but it's also a convention leak — the password `opsboard123` now exists in git history, in `dist/`, and in anyone's clone. If a developer ever points this service at a shared dev DB with that cred set, any clone has access.
**Fix:** `throw new Error('DATABASE_URL env var is required')` on startup. Match the pattern already used for `FRONTEND_URL` in `main.ts:13`.

---

### P1-4 — mustChangePassword allow-list uses `startsWith`
**File:** `backend/src/modules/auth/jwt.strategy.ts:73`
**What:** `if (!allow.some(p => path.startsWith(p)))` allows `/auth/password`, `/auth/password-anything`, `/auth/me-exfiltrate`, `/auth/logout?q=x`, `/auth/sse-ticket/admin`. Today no such routes exist, so it's latent. Adding a route like `/auth/password-reset-request` in the future would automatically be in the allow-list without anyone noticing.
**Fix:** Compare equality on the pathname or use a stricter regex. Parsing `req.url` also picks up the querystring — use `req.path` or strip query first.

---

## P2 — nice to fix

### P2-1 — GlobalExceptionFilter sets `code = r.error` which becomes `"Unauthorized"`
**File:** `backend/src/common/filters/global-exception.filter.ts:33`
**What:** Returned JSON looks like `{ statusCode: 401, code: "Unauthorized", message: "Invalid credentials", ... }`. The `code` field is meant for programmatic matching by the frontend but ends up being the HTTP status name, not a stable domain code. Frontend can't reliably branch on it.
**Fix:** Define an enum of app error codes (`AUTH_INVALID_CREDENTIALS`, `AUTH_REFRESH_REVOKED`, `AUTH_MUST_CHANGE_PASSWORD`, etc.) and attach them as the `error` field of `HttpException.getResponse()`. Verified on prod: `{"statusCode":401,"code":"Unauthorized","message":"Invalid credentials",...}`.

### P2-2 — `/auth/refresh` has no authentication beyond the refresh token itself
By design — but it's worth noting that rate limit is 20/min/IP. A credential-stuffing attack against stolen refresh tokens gets 20 tries/min from one IP before hitting 429. Consider dropping to 10/min to match login's budget more closely, since a valid refresh should happen at most every ~15 min per session.

### P2-3 — SSE ticket endpoint accessible under forced-rotation
**File:** `backend/src/modules/auth/jwt.strategy.ts:72`
`/auth/sse-ticket` is in the allow-list for `mustChangePassword=true` users. The NOW snapshot is read-only but the org's live incident counts leak to an operator who has not yet rotated the logged-once password. Low severity — the attacker would already have the password and a valid access token. Move `/auth/sse-ticket` out of the rotation allow-list and have the frontend defer SSE connection until after the forced modal closes.

### P2-4 — 001 migration is not idempotent
**File:** `backend/prisma/migrations/001_init/migration.sql`
`CREATE TYPE` and `CREATE TABLE` (bare, not `IF NOT EXISTS`) will throw on partial re-run. The migrate.js "already exists" heuristic saves it today, but see P0-3.
**Fix:** Add `IF NOT EXISTS` to every DDL statement, or gate on a `DO $$ BEGIN ... EXCEPTION ... END $$` block for `CREATE TYPE`.

### P2-5 — `User.findMany` in `pg.service.ts` ignores `orderBy` and silently drops selects
**File:** `backend/src/modules/prisma/pg.service.ts:82-86`
Admin.listUsers passes `orderBy: { fullName: 'asc' }` but the shim ignores it. Admin panel will render users in insert order, not alphabetical as Atlas's Admin code expects. UI regression, not security.

---

## Clean-pass list — explicitly verified good

These were looked at end-to-end and found to do what they claim:

1. **Throttler is live in prod**: `POST /auth/login` returns `x-ratelimit-limit: 5`, 429 after the 5th attempt within 60s (probed 8 times from this auditor's IP). Global default `120/min` returned on `/health`.
2. **Helmet is live in prod**: verified presence of `strict-transport-security`, `x-frame-options: SAMEORIGIN`, `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, `cross-origin-opener-policy`, `cross-origin-resource-policy`. `x-powered-by` is absent.
3. **CORS is pinned to a single origin**: preflight from `Origin: https://evil.example.com` returns `access-control-allow-origin: https://frontend-production-acba.up.railway.app` — browser will reject the mismatch. `credentials: true` with a fixed origin is the correct pattern.
4. **SSE endpoint requires auth**: `GET /sse/now` without token → 401. With a syntactically-valid bogus token → 401.
5. **JwtStrategy's two-dimensional scoping is correct**: typ='sse' rejected on `/auth/me`, typ missing (regular access token) rejected if source is `?token=` query, SSE ticket rejected on any path not starting with `/sse/`. Read the control flow in `jwt.strategy.ts:25-42` — it is correct as written.
6. **tokenVersion stamping is end-to-end**: `login` and `issueTokens` write `tv` into both access and refresh. `refresh` reads `tv` from payload, looks up current from DB, compares. `JwtStrategy.validate` does the same for access tokens. `changePassword` increments `tv` and re-issues so the caller's own session survives. Logic is correct *if* the column exists (see P0-1).
7. **mustChangePassword gate is end-to-end**: `seed.js` writes `TRUE` for the 3 seeded accounts. `changePassword` clears it. JwtStrategy checks it and enforces the allow-list. `/auth/me` surfaces it to the frontend. Logic is correct *if* the column exists (see P0-1).
8. **trust-proxy is set correctly for Railway**: `app.set('trust proxy', true)` at `main.ts:21`. Throttler buckets by real client IP — confirmed by the 429 arriving on the 6th request from this auditor's single IP instead of bucketing per Railway edge node.
9. **All non-auth controllers apply `JwtAuthGuard` at class level**: `context`, `incidents`, `operations`, `shifts`, `admin`, `sse` — verified by grep. No route accidentally public.
10. **No login-info-leak enumeration regression**: integration test `same error message for wrong password vs unknown email` still passes the same assertion after the recent commits.
11. **Refresh token rotation is real**: `changePassword` returns fresh tokens (the `...this.issueTokens(...)` spread at `auth.service.ts:110-111`), so the caller's session continues with the new `tv`. The frontend does not need an extra round-trip.
12. **Login endpoint per-IP limit is 5/min, change-password 5/min, refresh 20/min, sse-ticket 30/min** — verified against `auth.controller.ts` decorators and behaviourally against prod for login.

No regression was observed on the 4 currently-deployed flows (`/health`, `/auth/login`, `/auth/refresh`, `/sse/now`). Atlas did not break running prod. He just made the next clean deploy undeployable without manual intervention.

---

## Recommended fix order (~90 min)

1. P0-1 + P0-2 + P0-3 — fix `migrate.js` to loop all migrations in sorted order + record applied versions. One file, ~25 LOC.
2. P1-3 — throw on missing `DATABASE_URL`. One line.
3. P1-1 — narrow the refresh try/catch. Four lines.
4. P1-4 — tighten allow-list to equality comparison. One line.
5. P1-2 — add the 10 missing tests. ~120 LOC across the two spec files.
6. P2 items — defer to next sprint.
