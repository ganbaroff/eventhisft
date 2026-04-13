# OPSBOARD — Open Questions

These must NOT be silently guessed. Resolve before the relevant sprint.

## Q-001 — Multi-event support timeline
**Needed for:** Admin module design
**Question:** Will OPSBOARD need to manage multiple simultaneous events (projects) in MVP, or is WUF13 the only active project?
**Default assumption until resolved:** Single active project per organization in MVP.

## Q-002 — Coordinator zone/service assignment
**Needed for:** Operations module, NOW screen
**Question:** Are coordinators assigned to specific zones/services, or do they operate across all?
**Default assumption:** Coordinators are scoped to assigned services.

## Q-003 — Offline conflict resolution
**Needed for:** Sprint 5
**Question:** If two coordinators submit a draft for the same service/zone offline, what is the resolution policy?
**Default assumption:** Last-write-wins with both entries preserved and flagged for manual review.

## Q-004 — Notification / alert delivery
**Needed for:** Alert module
**Question:** Are alerts delivered in-app only, or also via email/SMS/push?
**Default assumption:** In-app only in MVP.

## Q-005 — Data retention policy
**Needed for:** Database design
**Question:** How long are incidents and operations retained? Is archival needed?
**Default assumption:** No archival in MVP. All data retained indefinitely.
