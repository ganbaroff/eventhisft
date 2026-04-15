# OPSBOARD — Claude Code Handoff

## Project
Operational platform for live events. First use: WUF13 Guest Services.

## Stack
- Backend: NestJS + PostgreSQL (via PgService — custom pg driver, no Prisma binary needed)
- Frontend: React 18 + TypeScript + Vite + PWA
- Deploy: Railway (backend) + Vercel (frontend)

## Status
- Sprint C complete
- 172 backend tests + 44 frontend tests — all passing
- Backend deployed to Railway (check if running)
- Frontend NOT yet deployed to Vercel

## Repo
github.com/ganbaroff/eventhisft

## Local dev
```bash
# Backend
cd backend
cp .env.example .env  # fill in values
npm install
npm run start:dev

# Frontend  
cd frontend
cp .env.example .env  # set VITE_API_URL=http://localhost:3001
npm install
npm run dev
```

## Railway (backend)
- Service: eventhisft
- Root directory: backend
- Start command: bash scripts/deploy.sh
- Env vars needed: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, PORT=3001, NODE_ENV=production

## Vercel (frontend) — NOT DONE
- Root directory: frontend
- Build command: npm run build
- Output directory: dist
- Env var: VITE_API_URL=https://YOUR_RAILWAY_URL

## Default accounts (change on first login)
- admin@opsboard.local / admin123
- manager@opsboard.local / manager123
- coord@opsboard.local / coord123

## What needs doing next
1. Verify Railway deployment is running — check logs
2. Get Railway public URL → set FRONTEND_URL env var
3. Deploy frontend to Vercel with VITE_API_URL pointing to Railway
4. Open app in real browser — first real test
5. Change default passwords
6. Run shadow test checklist: docs/shadow-test-checklist.md

## Architecture decisions
- PgService (backend/src/modules/prisma/pg.service.ts) replaces Prisma
  because Prisma binaries don't work in some environments.
  On Railway, Prisma works — can switch back if needed.
- SSE at /sse/now for real-time updates (JWT via ?token= param)
- Offline drafts via IndexedDB

## Key files
- docs/handoff.md — full feature list
- docs/deployment.md — step by step deploy guide
- docs/shadow-test-checklist.md — what to test before go-live
- backend/scripts/deploy.sh — migration + seed + start
- backend/prisma/migrations/001_init/migration.sql — DB schema
