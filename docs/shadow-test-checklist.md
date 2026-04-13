# OPSBOARD — Shadow Test Checklist
# Sprint 7: Stabilization / Shadow Test Prep
# Run this checklist before any live event deployment.

---

## PRE-DEPLOYMENT

### Infrastructure
- [ ] Backend deployed to Railway and responding at /auth/me
- [ ] Frontend deployed to Vercel and loading login screen
- [ ] PostgreSQL migrated (prisma migrate deploy)
- [ ] Seed data created (org, project, dept, zones, services, shifts)
- [ ] Default passwords changed from seed values
- [ ] CORS configured correctly (FRONTEND_URL in Railway env)
- [ ] VITE_API_URL pointing to correct Railway URL
- [ ] HTTPS active on both Vercel and Railway
- [ ] JWT_SECRET and JWT_REFRESH_SECRET are strong, different values

### Accounts
- [ ] Admin account created and login tested
- [ ] At least one Senior Manager account created and login tested
- [ ] At least 2 Coordinator accounts created and login tested
- [ ] Service assignments made (coordinators assigned to services)
- [ ] All roles verified by logging in with each account

---

## FUNCTIONAL TEST FLOWS

### Flow 1 — Shift Lifecycle (Manager)
- [ ] Login as Senior Manager
- [ ] Go to ADMIN → SHIFTS
- [ ] Create new shift "Shadow Test Shift"
- [ ] Open the shift → status becomes ACTIVE
- [ ] Topbar shows "SHIFT: Shadow Test Shift"
- [ ] Close the shift → status becomes CLOSED
- [ ] Verify submitted operations are LOCKED after close

### Flow 2 — Incident Lifecycle (Coordinator)
- [ ] Login as Coordinator
- [ ] Open an active shift (as manager first)
- [ ] Go to INCIDENTS → NEW INCIDENT
- [ ] Create incident: Type=COMPLAINT, fill title, select zone and service
- [ ] Submit → incident appears in list with status ACTIVE
- [ ] Open incident → add a note → note appears in timeline
- [ ] Login as Manager
- [ ] Escalate the incident → status becomes ESCALATED
- [ ] Incident appears in NOW screen under "REQUIRES ATTENTION"
- [ ] Resolve the incident → status becomes RESOLVED
- [ ] Verify resolved incident no longer appears in NOW screen

### Flow 3 — Operations (Coordinator)
- [ ] Login as Coordinator with active shift
- [ ] Go to OPERATIONS
- [ ] Click LOG OPERATION → select service → add notes → SUBMIT
- [ ] Operation appears with status SUBMITTED and sync SYNCED
- [ ] Close shift as Manager → operation status becomes LOCKED

### Flow 4 — Offline Draft Capture (Coordinator)
- [ ] Login as Coordinator
- [ ] Disable network (DevTools → Network → Offline, or airplane mode)
- [ ] Verify OFFLINE indicator shows in topbar
- [ ] Create new incident → submit → appears as draft (PENDING)
- [ ] Go to DRAFTS → pending draft visible
- [ ] Re-enable network
- [ ] Verify auto-sync fires within a few seconds
- [ ] Verify draft disappears from DRAFTS and appears in INCIDENTS
- [ ] If sync fails → draft shows as REJECTED with reason

### Flow 5 — Role Access Control
- [ ] Coordinator cannot see ADMIN in nav
- [ ] Coordinator cannot escalate or resolve incidents (buttons hidden)
- [ ] Coordinator can create incidents and add notes
- [ ] Service Manager can escalate and resolve
- [ ] Senior Manager can open/close shifts
- [ ] Only Admin/Super Admin can create users

### Flow 6 — NOW Screen (Manager)
- [ ] Open NOW screen with no incidents → empty state shown
- [ ] Create escalated incident → appears in REQUIRES ATTENTION
- [ ] Count badges correct (escalated, active, total)
- [ ] Click incident row → navigates to detail

---

## LOAD AND EDGE CASES

### Edge Cases
- [ ] Login with wrong password → clear error message, no crash
- [ ] Submit incident with empty title → blocked (button disabled)
- [ ] Try to escalate an already-escalated incident → rejected by backend
- [ ] Try to open a shift when one is already active → rejected by backend with message
- [ ] Try to resolve a DRAFT incident directly → rejected by state machine
- [ ] Add note to RESOLVED incident → blocked (input hidden)
- [ ] Refresh page mid-session → stay logged in (token persists)
- [ ] JWT expires → auto-refresh happens, session continues

### Multi-user Scenarios
- [ ] Two coordinators logged in simultaneously → each sees correct incidents
- [ ] Manager escalates incident → coordinator refreshes → sees ESCALATED status
- [ ] Two coordinators both offline → both create drafts → both sync → both appear separately

---

## KNOWN LIMITATIONS TO COMMUNICATE TO USERS

Document these before go-live. These are NOT bugs — they are intentional MVP constraints.

1. **No real-time sync** — users must manually refresh to see other users' changes
2. **Offline resolve/escalate blocked** — only online state transitions are authoritative
3. **Rejected drafts require manual review** — go to DRAFTS screen to retry or delete
4. **No push notifications** — users must check NOW screen actively
5. **Single project** — system is scoped to one active project at a time
6. **No password reset UI** — admin must reset passwords via DB or seed script

---

## GO / NO-GO CRITERIA

### GO (safe to use in shadow mode)
- All Flow 1–4 tests pass
- Role access control verified
- Offline flow works end-to-end
- No data loss in any tested scenario

### NO-GO (block shadow test)
- Auth broken or tokens not refreshing
- Incident state transitions not enforced
- Offline drafts lost (not appearing in DRAFTS)
- Operations visible across services (scope leak)
- Crash on any primary user flow

---

## SHADOW TEST INSTRUCTIONS FOR COORDINATOR

Share this with field coordinators before the test:

> OPSBOARD Shadow Test — what to do:
>
> 1. Open the link on your tablet browser
> 2. Log in with your email and password
> 3. If you see NO ACTIVE SHIFT — do not create incidents yet, wait for manager to open shift
> 4. When shift is open — create incidents as they happen in real operations
> 5. If you go offline (poor wifi) — keep working normally, drafts save automatically
> 6. When back online — go to DRAFTS and verify everything synced
> 7. If something looks wrong — note the time, what you did, what happened
> 8. Do NOT use this for real operational decisions during shadow test — use normal process in parallel
