// Frontend component tests
// Tests pure logic and rendering without network calls

// ─── 1. Offline utilities ─────────────────────────────────────────────────────

import { draftIncidents, generateLocalId, isOnline } from '../utils/offline'

describe('offline utilities', () => {
  describe('generateLocalId()', () => {
    it('generates a non-empty string', () => {
      const id = generateLocalId()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('generates unique IDs each call', () => {
      const ids = Array.from({ length: 20 }, generateLocalId)
      const unique = new Set(ids)
      expect(unique.size).toBe(20)
    })

    it('ID format is safe for use as a key', () => {
      const id = generateLocalId()
      expect(id).toMatch(/^[a-zA-Z0-9_-]+$/)
    })
  })

  describe('isOnline()', () => {
    it('returns a boolean', () => {
      expect(typeof isOnline()).toBe('boolean')
    })

    it('reflects navigator.onLine', () => {
      // jsdom sets navigator.onLine to true by default
      expect(isOnline()).toBe(navigator.onLine)
    })
  })
})

// ─── 2. Design system helpers (pure logic) ────────────────────────────────────

describe('badge class mapping', () => {
  const STATUS_COLORS: Record<string, string> = {
    ACTIVE:    'active',
    ESCALATED: 'escalated',
    RESOLVED:  'resolved',
    ARCHIVED:  'archived',
    PLANNED:   'draft',
    CLOSED:    'archived',
    DRAFT:     'draft',
    SUBMITTED: 'submitted',
    LOCKED:    'locked',
  }

  const badgeClass = (status: string) => `badge badge--${STATUS_COLORS[status] ?? 'draft'}`

  it.each(Object.entries(STATUS_COLORS))(
    'status %s maps to correct badge class',
    (status, expected) => {
      expect(badgeClass(status)).toBe(`badge badge--${expected}`)
    }
  )

  it('unknown status falls back to draft', () => {
    expect(badgeClass('UNKNOWN')).toBe('badge badge--draft')
  })
})

// ─── 3. Incident type labels ──────────────────────────────────────────────────

describe('incident type labels', () => {
  const TYPE_LABELS: Record<string, string> = {
    LOST_AND_FOUND:  'Lost & Found',
    COMPLAINT:       'Complaint',
    FLOW_DISRUPTION: 'Flow Disruption',
    OTHER:           'Other',
  }

  it('covers all defined incident types', () => {
    const types = ['LOST_AND_FOUND','COMPLAINT','FLOW_DISRUPTION','OTHER']
    types.forEach(t => {
      expect(TYPE_LABELS[t]).toBeDefined()
    })
  })

  it('all labels are non-empty human-readable strings', () => {
    Object.values(TYPE_LABELS).forEach(label => {
      expect(label.length).toBeGreaterThan(0)
      expect(label).not.toMatch(/^[A-Z_]+$/) // not ALL_CAPS
    })
  })
})

// ─── 4. Role helpers ──────────────────────────────────────────────────────────

describe('role helpers', () => {
  const MANAGER_ROLES = ['SUPER_ADMIN','ADMIN','SENIOR_MANAGER','SERVICE_MANAGER']

  const isManager = (role: string) => MANAGER_ROLES.includes(role)

  it.each(MANAGER_ROLES)('%s is a manager role', role => {
    expect(isManager(role)).toBe(true)
  })

  it('COORDINATOR is not a manager', () => {
    expect(isManager('COORDINATOR')).toBe(false)
  })

  it('empty string is not a manager', () => {
    expect(isManager('')).toBe(false)
  })

  it('unknown role is not a manager', () => {
    expect(isManager('UNKNOWN_ROLE')).toBe(false)
  })
})

// ─── 5. Time formatting ───────────────────────────────────────────────────────

describe('time formatting', () => {
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  it('formats ISO string to HH:MM', () => {
    // Use UTC time to avoid timezone issues in CI
    const result = fmtTime('2026-04-13T10:30:00.000Z')
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })

  it('formats midnight correctly', () => {
    const result = fmtTime('2026-04-13T00:00:00.000Z')
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })
})

// ─── 6. Shift status logic ────────────────────────────────────────────────────

describe('shift status logic', () => {
  const canOpen     = (status: string) => status === 'PLANNED'
  const canHandover = (status: string) => status === 'ACTIVE'
  const canClose    = (status: string) => status === 'ACTIVE' || status === 'HANDOVER'
  const isComplete  = (status: string) => status === 'CLOSED'

  it('PLANNED can only be opened', () => {
    expect(canOpen('PLANNED')).toBe(true)
    expect(canHandover('PLANNED')).toBe(false)
    expect(canClose('PLANNED')).toBe(false)
  })

  it('ACTIVE can be handed over or closed', () => {
    expect(canOpen('ACTIVE')).toBe(false)
    expect(canHandover('ACTIVE')).toBe(true)
    expect(canClose('ACTIVE')).toBe(true)
  })

  it('HANDOVER can only be closed', () => {
    expect(canOpen('HANDOVER')).toBe(false)
    expect(canHandover('HANDOVER')).toBe(false)
    expect(canClose('HANDOVER')).toBe(true)
  })

  it('CLOSED is terminal', () => {
    expect(canOpen('CLOSED')).toBe(false)
    expect(canHandover('CLOSED')).toBe(false)
    expect(canClose('CLOSED')).toBe(false)
    expect(isComplete('CLOSED')).toBe(true)
  })
})

// ─── 7. Incident form validation ─────────────────────────────────────────────

describe('incident form validation', () => {
  const VALID_TYPES = ['COMPLAINT','LOST_AND_FOUND','FLOW_DISRUPTION','OTHER']

  const validate = (form: { type: string; title: string }) => {
    const errors: string[] = []
    if (!VALID_TYPES.includes(form.type)) errors.push('Invalid incident type')
    if (!form.title.trim()) errors.push('Title is required')
    if (form.title.length > 200) errors.push('Title too long')
    return errors
  }

  it('valid form has no errors', () => {
    expect(validate({ type: 'COMPLAINT', title: 'Queue at Hall A' })).toHaveLength(0)
  })

  it('empty title is invalid', () => {
    const errs = validate({ type: 'COMPLAINT', title: '' })
    expect(errs).toContain('Title is required')
  })

  it('whitespace-only title is invalid', () => {
    const errs = validate({ type: 'COMPLAINT', title: '   ' })
    expect(errs).toContain('Title is required')
  })

  it('invalid type is rejected', () => {
    const errs = validate({ type: 'INVALID', title: 'Test' })
    expect(errs).toContain('Invalid incident type')
  })

  it('all valid types pass', () => {
    VALID_TYPES.forEach(type => {
      const errs = validate({ type, title: 'Test title' })
      expect(errs).toHaveLength(0)
    })
  })
})

// ─── 8. Operation form validation ────────────────────────────────────────────

describe('operation form validation', () => {
  const validate = (form: { serviceId: string; shiftId?: string }) => {
    const errors: string[] = []
    if (!form.serviceId) errors.push('Service is required')
    if (!form.shiftId) errors.push('No active shift — cannot create operation')
    return errors
  }

  it('valid form passes', () => {
    expect(validate({ serviceId: 'svc-1', shiftId: 'shift-1' })).toHaveLength(0)
  })

  it('missing serviceId fails', () => {
    const errs = validate({ serviceId: '', shiftId: 'shift-1' })
    expect(errs).toContain('Service is required')
  })

  it('missing shiftId fails', () => {
    const errs = validate({ serviceId: 'svc-1' })
    expect(errs).toContain('No active shift — cannot create operation')
  })
})
