// OPSBOARD — Core TypeScript Types

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'SENIOR_MANAGER'
  | 'SERVICE_MANAGER'
  | 'COORDINATOR'

export type ShiftStatus = 'PLANNED' | 'ACTIVE' | 'HANDOVER' | 'CLOSED'

export type OperationStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED'

export type IncidentType =
  | 'LOST_AND_FOUND'
  | 'COMPLAINT'
  | 'FLOW_DISRUPTION'
  | 'OTHER'

export type IncidentStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'ARCHIVED'

export type AlertStatus = 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED'

export type SyncState = 'SYNCED' | 'PENDING_CONFIRMATION' | 'REJECTED'

// ─── Entities ────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  fullName: string
  role: UserRole
  isActive: boolean
}

export interface Service {
  id: string
  name: string
  departmentId: string
  isActive: boolean
}

export interface Zone {
  id: string
  name: string
  projectId: string
  isActive: boolean
}

export interface Shift {
  id: string
  name: string
  status: ShiftStatus
  startsAt: string
  endsAt?: string
  openedAt?: string
  closedAt?: string
  openedBy?: Pick<User, 'id' | 'fullName'>
}

export interface Incident {
  id: string
  type: IncidentType
  status: IncidentStatus
  title: string
  description?: string
  zone?: Pick<Zone, 'id' | 'name'>
  service?: Pick<Service, 'id' | 'name'>
  createdBy: Pick<User, 'id' | 'fullName'>
  createdAt: string
  updatedAt: string
  syncState: SyncState
  notes?: IncidentNote[]
  resolvedBy?: Pick<User, 'id' | 'fullName'>
  archivedAt?: string
  resolvedAt?: string
}

export interface IncidentNote {
  id: string
  body: string
  author: Pick<User, 'id' | 'fullName'>
  createdAt: string
}

export interface Operation {
  id: string
  status: OperationStatus
  notes?: string
  service: Pick<Service, 'id' | 'name'>
  zone?: Pick<Zone, 'id' | 'name'>
  createdBy: Pick<User, 'id' | 'fullName'>
  createdAt: string
  syncState: SyncState
}

export interface Alert {
  id: string
  status: AlertStatus
  message: string
  incident?: Pick<Incident, 'id' | 'title'>
  createdAt: string
}

// ─── API types ───────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AppContext {
  user: User
  project: { id: string; name: string }
  department: { id: string; name: string }
  activeShift?: Shift
  assignedServices: Service[]
}

// ─── Offline draft types ─────────────────────────────────────────────────────

export interface LocalDraftIncident {
  localId: string
  type: IncidentType
  title: string
  description?: string
  zoneId?: string
  serviceId?: string
  createdAt: string
  syncState: 'PENDING_CONFIRMATION' | 'REJECTED'
  rejectionReason?: string
}

export interface LocalDraftOperation {
  localId: string
  serviceId: string
  zoneId?: string
  notes?: string
  createdAt: string
  syncState: 'PENDING_CONFIRMATION' | 'REJECTED'
  rejectionReason?: string
}
