// OPSBOARD — Shift Lifecycle Rules
// Pure logic. No DB. No side effects.

export type ShiftStatus = 'PLANNED' | 'ACTIVE' | 'HANDOVER' | 'CLOSED'

export const MANAGER_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'SENIOR_MANAGER',
  'SERVICE_MANAGER',
] as const

export type ManagerRole = typeof MANAGER_ROLES[number]

export function canOpenShift(status: ShiftStatus): boolean {
  return status === 'PLANNED'
}

export function canCloseShift(status: ShiftStatus): boolean {
  return status === 'ACTIVE' || status === 'HANDOVER'
}

export function isManagerRole(role: string): boolean {
  return MANAGER_ROLES.includes(role as ManagerRole)
}

export function assertCanOpen(status: ShiftStatus, role: string): void {
  if (!isManagerRole(role)) {
    throw new Error(`Role '${role}' cannot open shifts. Required: manager role.`)
  }
  if (!canOpenShift(status)) {
    throw new Error(`Cannot open shift with status '${status}'. Only PLANNED shifts can be opened.`)
  }
}

export function assertCanClose(status: ShiftStatus, role: string): void {
  if (!isManagerRole(role)) {
    throw new Error(`Role '${role}' cannot close shifts. Required: manager role.`)
  }
  if (!canCloseShift(status)) {
    throw new Error(`Cannot close shift with status '${status}'. Only ACTIVE or HANDOVER shifts can be closed.`)
  }
}
