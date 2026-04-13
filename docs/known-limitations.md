# OPSBOARD — Known Limitations

This document is honest. These are intentional MVP constraints, not defects.
Communicate these to users before go-live.

---

## UX Limitations

### No real-time updates
**What this means:** If coordinator A creates an incident, coordinator B will not see it
until they refresh the page.

**Severity:** Medium. Workaround: coordinators should refresh NOW screen periodically.

**Future path:** WebSocket or polling on NOW screen. Out of MVP scope.

---

### No push notifications
**What this means:** Escalated incidents do not trigger any notification sound, badge,
or device notification. Users must actively check the NOW screen.

**Severity:** Medium. Workaround: managers should open NOW screen on a visible tablet.

**Future path:** In-app alert polling or PWA push. Out of MVP scope.

---

### Offline state is one-way
**What this means:** Drafts created offline are queued for upload, but users cannot
resolve or escalate incidents while offline. Only capture is possible offline.

**Severity:** Low for most field use. Design decision — offline resolve creates
false certainty.

---

### No conflict resolution for simultaneous offline drafts
**What this means:** If two coordinators both create a draft for the same service/zone
while offline, both will be submitted as separate incidents on sync. They will not
be automatically merged.

**Severity:** Low. Both appear in the incident list and can be reviewed manually.

---

## Admin Limitations

### No password reset UI
**What this means:** If a user forgets their password, an admin must reset it via
the database or create a new account.

**Workaround:** Use `npx prisma studio` on Railway or run a seed script update.

**Future path:** Password reset email flow. Out of MVP scope.

---

### No user service assignment UI
**What this means:** Assigning which services a coordinator can see requires
direct database access or a seed script.

**Workaround:** Use `prisma studio` or add entries to `UserService` table directly.

**Future path:** User-service assignment screen in Admin. Priority for post-MVP.

---

### Single active project
**What this means:** The system assumes one active project per organization.
Multiple simultaneous projects are not supported in MVP.

**Workaround:** Run separate deployments for separate events.

**Future path:** Project selector in Admin. Out of MVP scope.

---

## Data Limitations

### No archival / export
**What this means:** There is no way to export incidents or operations to CSV,
PDF, or other formats from the UI.

**Workaround:** Direct database query or Prisma Studio for post-event reporting.

**Future path:** Export module. Out of MVP scope.

---

### No audit UI
**What this means:** Audit events are written to the database but not visible
in the UI. Only a database admin can view them.

**Workaround:** Query `AuditEvent` table directly.

**Future path:** Audit log viewer for admins. Out of MVP scope.

---

## Not Limitations — By Design

These are things some users might expect but are intentionally absent:

- No trend graphs or dashboards on NOW screen (creates false confidence)
- No deleting incidents (append-only operational truth)
- No bulk actions on incidents (accidental mass changes are too risky)
- No workflow builder (complexity belongs in product team, not field config)
- No hardcoded staff/volunteer/zone counts (prevents false precision)
