# OPSBOARD — Domain Model

## Core Entities

### Organization
Top-level owner. Rarely changes. All other entities belong to an organization.

### Project / Event
Operational container. WUF13 is first use case. Must NOT be hardcoded.

### Department
Operational grouping within a project. Flexible across deployments.

### Zone
Operational context. Not the primary owner of truth — service context is more stable.

### Service
Operational function / service unit. Primary context for operations.

### User
A real person. All meaningful actions must be attributable to a user.

Fields: id, organization_id, email, password_hash, full_name, role, is_active, created_at

Roles: SUPER_ADMIN | ADMIN | SENIOR_MANAGER | SERVICE_MANAGER | COORDINATOR

### Shift
Critical temporal container. Drives data rules and UX context.

Fields: id, project_id, department_id, name, starts_at, ends_at, status, opened_by, closed_by

Status: PLANNED | ACTIVE | HANDOVER | CLOSED

### Operation
Routine operational capture entity. Belongs to a shift and service.

Fields: id, shift_id, service_id, zone_id, created_by, status, notes, submitted_at, locked_at

Status: DRAFT | SUBMITTED | LOCKED

### Incident
Operational exception entity with lifecycle and audit trail.

Fields: id, project_id, zone_id, service_id, type, status, title, created_by, created_at, resolved_at, resolved_by

Types: LOST_AND_FOUND | COMPLAINT | FLOW_DISRUPTION | OTHER

Status: DRAFT | ACTIVE | ESCALATED | RESOLVED | ARCHIVED

### IncidentNote
Append-only timeline entry for an incident.

Fields: id, incident_id, author_id, body, created_at

Never updated. Never deleted.

### Alert
Minimal in MVP. Triggered by significant state transitions.

Status: TRIGGERED | ACKNOWLEDGED | RESOLVED

### AuditEvent
Append-only log of meaningful system changes.

Fields: id, entity_type, entity_id, actor_id, action, payload, created_at

## Global Modeling Rules

- Staff counts are data, not hardcoded logic
- Volunteer counts are data, not hardcoded logic
- Zone structures can change and must not be hardcoded
- Service structures can change and must not be hardcoded
- No destructive history rewrites
- Append-only is preferred for operational truth
- All meaningful actions must be attributable to a real user
