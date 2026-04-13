# OPSBOARD — Current Sprint

## Sprint 7 — Stabilization / Shadow Test Prep ✅ COMPLETE

### What was done

**Backend hardening**
- Global exception filter — consistent JSON error responses, no stack traces to client
- Health check endpoint (GET /health) for Railway monitoring
- Shift open guard: blocks opening if another shift already active in dept

**Frontend stability**
- useAutoRefresh hook — NOW screen polls every 30s, stops offline, resumes on reconnect
- Manual refresh button on NOW screen
- Last-refresh timestamp shown in NOW subtitle
- Service shown in NOW incident rows (was missing)
- NowPage empty state text improved (mentions auto-refresh)

**Documentation**
- /docs/shadow-test-checklist.md — full pre-deployment + flow tests + go/no-go criteria
- /docs/known-limitations.md — honest list of MVP constraints with severity + workarounds
- /docs/field-reference-card.html — printable coordinator quick reference

---

## All sprints complete

Sprint 0  ✅ Foundation (docs, schema, structure)
Sprint 1  ✅ Infrastructure skeleton (all pages, auth, API, offline)
Sprint 2  ✅ Integration (toast, sync, shift management)
Sprint 3  ✅ Gap closure (zone dropdown, drafts UI, user/shift creation)
Sprint 7  ✅ Stabilization (error handling, auto-refresh, shadow test docs)

## Next action
Deploy per /docs/deployment.md
Run /docs/shadow-test-checklist.md before go-live
