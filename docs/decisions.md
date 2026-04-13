# OPSBOARD — Decisions Log

## D-001 — Stack Selection
**Date:** Sprint 0
**Decision:** React + TypeScript + Vite (frontend) / NestJS + PostgreSQL (backend)
**Reason:** Internal authenticated ops tool. SPA is appropriate. NestJS gives architectural discipline. PostgreSQL gives transactional reliability and audit-friendly data.
**Alternatives rejected:** GraphQL (unnecessary), microservices (premature), Supabase as core (not reliable for offline-critical backbone)

## D-002 — Deployment
**Date:** Sprint 0
**Decision:** Vercel (frontend) + Railway (backend + DB)
**Reason:** Fast start, no DevOps overhead, free tier covers MVP validation.
**Review trigger:** If usage exceeds Railway free tier or data residency requirements appear.

## D-003 — Authentication
**Date:** Sprint 0
**Decision:** Email/password + JWT (access token + refresh token)
**Reason:** Sufficient for internal ops tool. No external SSO dependency needed at MVP.
**Review trigger:** If organization mandates SSO/LDAP.

## D-004 — Shift Management
**Date:** Sprint 0
**Decision:** Shifts are opened and closed manually by a manager
**Reason:** Ops tool — humans must control operational boundaries, not automation.
**Review trigger:** Only if explicit scheduling requirement appears from real users.

## D-005 — Offline Strategy
**Date:** Sprint 0
**Decision:** IndexedDB for local drafts. Service Worker for shell caching. No CRDT. No silent merge. Explicit sync state (SYNCED / PENDING / REJECTED).
**Reason:** Simplest honest approach. Avoids false confidence. Avoids speculative complexity.

## D-006 — ORM
**Date:** Sprint 0
**Decision:** Prisma
**Reason:** Type-safe, excellent PostgreSQL support, migration management built-in.
