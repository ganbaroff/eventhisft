# OPSBOARD — Handoff Document
## Last updated: Sprint C

## Current state
Sprints 0–C complete. All MVP features implemented and live-tested.

## Test coverage
- Backend unit/integration: 172/172 ✅
- Frontend unit: 44/44 ✅
- Live HTTP suite: 49/53 ✅ (4 SSE tests false-negative due to socket timing — SSE verified separately via curl)

## Feature checklist

### Backend (NestJS + PgService + PostgreSQL)
- [x] Auth: login, refresh, /me, password change
- [x] Context: user + project + shift + services
- [x] Incidents: list, get, create, notes, escalate, resolve, archive
- [x] Incident state machine: ACTIVE → ESCALATED → RESOLVED → ARCHIVED (terminal)
- [x] Role enforcement: coordinator cannot escalate/resolve/archive
- [x] Operations: list, create, submit, locked on shift close
- [x] Shifts: list, active, open, handover, close
- [x] Shift state machine: PLANNED → ACTIVE → HANDOVER → CLOSED
- [x] Admin: users CRUD, zones CRUD, services CRUD, shifts create
- [x] User-service assignment: GET/POST /admin/users/:id/services
- [x] Service create: auto-resolves departmentId from user's project
- [x] SSE: /sse/now — pushes every 15s, JWT via URL param
- [x] Audit trail: all state transitions recorded

### Frontend (React + Vite + PWA)
- [x] Login page
- [x] App shell: sidebar nav, topbar with shift/online status, SSE live indicator
- [x] NOW screen: escalated alerts, stat cards, active incidents table, SSE real-time
- [x] Incidents: list with status filter, detail with timeline, create form
- [x] Incident actions: escalate, resolve, archive (role-gated)
- [x] Operations: create, submit, locked state display
- [x] Drafts: view, delete, sync (offline-first)
- [x] Admin: shifts (open/handover/close), users (create/deactivate/services), zones, services
- [x] Change password modal (topbar 🔑 button)
- [x] User-service assignment modal
- [x] Error boundary
- [x] PWA manifest + service worker
- [x] IBM Plex Mono/Sans design system, military ops aesthetic

### Infrastructure
- [x] migration.sql: 13 tables, tested on fresh DB
- [x] deploy.sh: migration + seed + start
- [x] seed.ts: pg + bcryptjs (no Prisma binary)
- [x] railway.json + vercel.json
- [x] GitHub Actions CI
- [x] Default accounts: admin/manager/coord with known passwords

## Accounts (default — change on first login via 🔑 button)
- admin@opsboard.local / admin123 (ADMIN)
- manager@opsboard.local / manager123 (SENIOR_MANAGER)
- coord@opsboard.local / coord123 (COORDINATOR)

## Deploy steps
1. Railway: new project → add PostgreSQL → deploy backend (root: backend/, start: bash scripts/deploy.sh)
2. Set env vars: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, PORT=3001, FRONTEND_URL
3. Vercel: deploy frontend (root: frontend/), set VITE_API_URL=https://YOUR_RAILWAY_URL

## Known limitations (intentional MVP scope)
- No real-time push to other clients when new incident created (SSE pushes counts, full list refresh on tab open)
- No password reset via email (change via UI or admin PATCH)
- Offline: draft create only — no offline escalate/resolve/archive
- No bulk incident actions
- Single organization/project (WUF13)
