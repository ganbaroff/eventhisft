# OPSBOARD

Operational platform for live events. Built for WUF13 Guest Services.

## Stack
- **Backend**: NestJS + TypeScript + PostgreSQL
- **Frontend**: React 18 + TypeScript + Vite + PWA
- **Deploy**: Railway (backend) + Vercel (frontend)

## Quick Start

```bash
# Backend
cd backend
cp .env.example .env     # fill DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
npm install
npm run start:dev        # http://localhost:3001

# Frontend (separate terminal)
cd frontend
cp .env.example .env     # set VITE_API_URL=http://localhost:3001
npm install
npm run dev              # http://localhost:5173
```

## Default accounts
| Email | Password | Role |
|-------|----------|------|
| admin@opsboard.local | admin123 | Admin |
| manager@opsboard.local | manager123 | Senior Manager |
| coord@opsboard.local | coord123 | Coordinator |

> ⚠️ Change passwords on first login via the 🔑 button in the top bar.

## Tests

```bash
cd backend && npm test        # 176 tests
cd frontend && npm test       # 44 tests
```

## Deploy

### Railway (backend)
1. New project → Add PostgreSQL service
2. Add GitHub service → select this repo
3. Settings: Root Directory = `backend`
4. Variables:
```
DATABASE_URL=<from postgres service>
JWT_SECRET=<random 32 chars>
JWT_REFRESH_SECRET=<random 32 chars>
PORT=3001
NODE_ENV=production
```

### Vercel (frontend)
1. Import from GitHub → select this repo
2. Root Directory: `frontend`
3. Environment variable: `VITE_API_URL=https://your-railway-url`

## Features
- **NOW** — live operational status, escalated alerts, SSE real-time updates
- **Incidents** — full lifecycle: ACTIVE → ESCALATED → RESOLVED → ARCHIVED
- **Operations** — shift-scoped entries, offline draft capture
- **Shifts** — PLANNED → ACTIVE → HANDOVER → CLOSED
- **Admin** — users, zones, services, shift management
- **Offline** — drafts saved locally, sync on reconnect
- **PWA** — installable on mobile/tablet

## Architecture
See `docs/` for full documentation:
- `docs/handoff.md` — complete feature list and status
- `docs/deployment.md` — step-by-step deploy guide
- `docs/shadow-test-checklist.md` — pre-launch checklist
- `CLAUDE.md` — handoff notes for Claude Code
