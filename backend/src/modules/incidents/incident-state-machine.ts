// OPSBOARD — Incident State Machine
// Pure logic. No DB. No side effects. Fully testable.

export type IncidentStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'ARCHIVED'

// Valid transitions: key = current status, value = allowed next statuses
export const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  DRAFT:     ['ACTIVE'],
  ACTIVE:    ['ESCALATED', 'RESOLVED'],
  ESCALATED: ['RESOLVED'],
  RESOLVED:  ['ARCHIVED'],
  ARCHIVED:  [],
}

export function canTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid transition: ${from} → ${to}. Allowed from ${from}: [${ALLOWED_TRANSITIONS[from]?.join(', ') ?? 'none'}]`,
    )
  }
}

// All reachable statuses from a given status (direct only)
export function nextStatuses(from: IncidentStatus): IncidentStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? []
}

// Check if status is terminal (no further transitions possible)
export function isTerminal(status: IncidentStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0
}
