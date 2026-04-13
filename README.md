# OPSBOARD

Adaptive operations platform for live events and operational departments.

## What this is

OPSBOARD gives coordinators and managers a single operational source of truth during live event time.

First use case: WUF13 / Guest Services.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + PWA |
| State | Zustand |
| Offline | IndexedDB + Service Worker |
| Backend | NestJS + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Deploy | Vercel (FE) + Railway (BE + DB) |
| Auth | JWT (access + refresh) |

## Project structure

```
opsboard/
├── docs/                    # Project memory — source of truth
│   ├── product-definition.md
│   ├── mvp-scope.md
│   ├── domain-model.md
│   ├── workflow-rules.md
│   ├── decisions.md
│   ├── current-sprint.md
│   ├── handoff.md
│   ├── non-goals.md
│   └── open-questions.md
├── frontend/
│   ├── src/
│   │   ├── components/      # Shared UI components
│   │   ├── pages/           # Screen-level components (NOW, Incidents, Operations, Admin)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── store/           # Zustand stores
│   │   ├── api/             # API client and request functions
│   │   ├── types/           # TypeScript types/interfaces
│   │   └── utils/           # Helpers, offline/IndexedDB utils
│   ├── public/
│   ├── vite.config.ts
│   └── package.json
└── backend/
    ├── src/
    │   ├── modules/         # Feature modules (auth, incidents, operations, shifts, admin)
    │   ├── common/          # Guards, interceptors, decorators, filters
    │   └── config/          # NestJS config, env validation
    ├── prisma/
    │   └── schema.prisma    # Database schema — all MVP entities
    └── package.json
```

## MVP modules

1. **NOW** — What requires attention right now
2. **INCIDENTS** — Capture and manage operational exceptions
3. **OPERATIONS** — Capture routine operational state
4. **ADMIN** — Minimal user/zone/service management
5. **OFFLINE** — Local draft capture with honest sync state

## Quick start (development)

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev

# Frontend
cd frontend
npm install
npm run dev
```

## Docs

All architectural decisions, scope boundaries, and open questions are in `/docs`.
Read `/docs/handoff.md` first when resuming work.
