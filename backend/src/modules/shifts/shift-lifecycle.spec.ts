import {
  canOpenShift,
  canCloseShift,
  isManagerRole,
  assertCanOpen,
  assertCanClose,
  ShiftStatus,
} from './shift-lifecycle'

describe('Shift Lifecycle', () => {

  // ── canOpenShift ───────────────────────────────────────────────────────────

  describe('canOpenShift()', () => {
    it('allows opening PLANNED shift', () => {
      expect(canOpenShift('PLANNED')).toBe(true)
    })

    it('blocks opening ACTIVE shift', () => {
      expect(canOpenShift('ACTIVE')).toBe(false)
    })

    it('blocks opening HANDOVER shift', () => {
      expect(canOpenShift('HANDOVER')).toBe(false)
    })

    it('blocks opening CLOSED shift', () => {
      expect(canOpenShift('CLOSED')).toBe(false)
    })
  })

  // ── canCloseShift ──────────────────────────────────────────────────────────

  describe('canCloseShift()', () => {
    it('allows closing ACTIVE shift', () => {
      expect(canCloseShift('ACTIVE')).toBe(true)
    })

    it('allows closing HANDOVER shift', () => {
      expect(canCloseShift('HANDOVER')).toBe(true)
    })

    it('blocks closing PLANNED shift', () => {
      expect(canCloseShift('PLANNED')).toBe(false)
    })

    it('blocks closing already CLOSED shift', () => {
      expect(canCloseShift('CLOSED')).toBe(false)
    })
  })

  // ── isManagerRole ──────────────────────────────────────────────────────────

  describe('isManagerRole()', () => {
    const managerRoles = ['SUPER_ADMIN', 'ADMIN', 'SENIOR_MANAGER', 'SERVICE_MANAGER']
    const nonManagerRoles = ['COORDINATOR', 'GUEST', '', 'admin', 'superadmin']

    test.each(managerRoles)('%s is a manager role', (role) => {
      expect(isManagerRole(role)).toBe(true)
    })

    test.each(nonManagerRoles)('%s is NOT a manager role', (role) => {
      expect(isManagerRole(role)).toBe(false)
    })

    it('is case-sensitive — lowercase roles not accepted', () => {
      expect(isManagerRole('admin')).toBe(false)
      expect(isManagerRole('coordinator')).toBe(false)
    })
  })

  // ── assertCanOpen ──────────────────────────────────────────────────────────

  describe('assertCanOpen()', () => {
    it('does not throw for manager + PLANNED shift', () => {
      expect(() => assertCanOpen('PLANNED', 'ADMIN')).not.toThrow()
      expect(() => assertCanOpen('PLANNED', 'SENIOR_MANAGER')).not.toThrow()
    })

    it('throws when coordinator tries to open shift', () => {
      expect(() => assertCanOpen('PLANNED', 'COORDINATOR')).toThrow(
        "Role 'COORDINATOR' cannot open shifts"
      )
    })

    it('throws when manager tries to open non-PLANNED shift', () => {
      const nonPlanned: ShiftStatus[] = ['ACTIVE', 'HANDOVER', 'CLOSED']
      nonPlanned.forEach((status) => {
        expect(() => assertCanOpen(status, 'ADMIN')).toThrow(
          `Cannot open shift with status '${status}'`
        )
      })
    })

    it('error message includes required role', () => {
      expect(() => assertCanOpen('PLANNED', 'COORDINATOR')).toThrow('manager role')
    })
  })

  // ── assertCanClose ─────────────────────────────────────────────────────────

  describe('assertCanClose()', () => {
    it('does not throw for manager + ACTIVE shift', () => {
      expect(() => assertCanClose('ACTIVE', 'SENIOR_MANAGER')).not.toThrow()
    })

    it('does not throw for manager + HANDOVER shift', () => {
      expect(() => assertCanClose('HANDOVER', 'ADMIN')).not.toThrow()
    })

    it('throws when coordinator tries to close shift', () => {
      expect(() => assertCanClose('ACTIVE', 'COORDINATOR')).toThrow(
        "Role 'COORDINATOR' cannot close shifts"
      )
    })

    it('throws when closing already CLOSED shift', () => {
      expect(() => assertCanClose('CLOSED', 'ADMIN')).toThrow(
        "Cannot close shift with status 'CLOSED'"
      )
    })

    it('throws when closing PLANNED shift', () => {
      expect(() => assertCanClose('PLANNED', 'ADMIN')).toThrow(
        "Cannot close shift with status 'PLANNED'"
      )
    })
  })

  // ── Lifecycle completeness ─────────────────────────────────────────────────

  describe('lifecycle symmetry', () => {
    it('a shift that can be opened cannot be closed', () => {
      const allStatuses: ShiftStatus[] = ['PLANNED', 'ACTIVE', 'HANDOVER', 'CLOSED']
      allStatuses.forEach((s) => {
        if (canOpenShift(s)) {
          expect(canCloseShift(s)).toBe(false)
        }
      })
    })

    it('CLOSED is neither openable nor closable', () => {
      expect(canOpenShift('CLOSED')).toBe(false)
      expect(canCloseShift('CLOSED')).toBe(false)
    })
  })
})
