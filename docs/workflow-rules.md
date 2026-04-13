# OPSBOARD — Workflow Rules

## Operation Lifecycle

DRAFT → SUBMITTED → LOCKED

- DRAFT: may exist locally offline
- SUBMITTED: becomes part of operational record (online only to confirm)
- LOCKED: immutable after shift closure

## Incident Lifecycle

DRAFT → ACTIVE → ESCALATED → RESOLVED → ARCHIVED

Rules:
- No direct DRAFT → RESOLVED
- No deleting incidents
- No destructive editing of incident history
- Timeline (IncidentNotes) is append-only
- Escalation must be explicit user action
- Resolution must be explicit user action (online only)
- All transitions must be attributable to a real user

## Alert Lifecycle

TRIGGERED → ACKNOWLEDGED → RESOLVED

- Keep alerts minimal in MVP
- Do not build a large alert rules engine

## Shift Lifecycle

PLANNED → ACTIVE → HANDOVER → CLOSED

- Shift is opened manually by a manager
- Shift is closed manually by a manager
- HANDOVER state exists for explicit shift transition moment
- CLOSED shifts create lock boundaries for operations

## Offline Rules

**Offline exists to prevent loss of work. It does NOT create authoritative truth.**

Allowed offline:
- Draft Operation (local only)
- Draft Incident (local only)
- Incident note draft (local only)

NOT allowed offline:
- Resolve incident
- Escalate incident
- Admin changes
- Shift open / close
- Bulk actions

Sync state must always be honest:
- SYNCED
- PENDING_CONFIRMATION
- REJECTED / NEEDS_REVIEW

Never pretend local save = confirmed server truth.
If sync state is uncertain → conservative and explicit.
