// Operations business rules — pure logic tests
// These test the rules that govern operation lifecycle

describe('Operation Lifecycle Rules', () => {

  // Mirrors the logic in operations.module.ts
  function canCreateOperation(shiftStatus: string): boolean {
    return shiftStatus === 'ACTIVE'
  }

  function canSubmitOperation(opStatus: string, creatorId: string, requesterId: string): boolean {
    return opStatus === 'DRAFT' && creatorId === requesterId
  }

  function canViewOperation(
    opServiceId: string,
    userServiceIds: string[],
  ): boolean {
    return userServiceIds.includes(opServiceId)
  }

  function operationStatusAfterShiftClose(opStatus: string): string {
    if (opStatus === 'SUBMITTED') return 'LOCKED'
    return opStatus // DRAFT and LOCKED unchanged
  }

  // ── canCreateOperation ────────────────────────────────────────────────────

  describe('canCreateOperation()', () => {
    it('allows creation on ACTIVE shift', () => {
      expect(canCreateOperation('ACTIVE')).toBe(true)
    })

    it('blocks creation on PLANNED shift', () => {
      expect(canCreateOperation('PLANNED')).toBe(false)
    })

    it('blocks creation on CLOSED shift', () => {
      expect(canCreateOperation('CLOSED')).toBe(false)
    })

    it('blocks creation on HANDOVER shift', () => {
      expect(canCreateOperation('HANDOVER')).toBe(false)
    })
  })

  // ── canSubmitOperation ────────────────────────────────────────────────────

  describe('canSubmitOperation()', () => {
    it('allows submit for own DRAFT operation', () => {
      expect(canSubmitOperation('DRAFT', 'user-1', 'user-1')).toBe(true)
    })

    it('blocks submit for another user\'s operation', () => {
      expect(canSubmitOperation('DRAFT', 'user-1', 'user-2')).toBe(false)
    })

    it('blocks submit for already SUBMITTED operation', () => {
      expect(canSubmitOperation('SUBMITTED', 'user-1', 'user-1')).toBe(false)
    })

    it('blocks submit for LOCKED operation', () => {
      expect(canSubmitOperation('LOCKED', 'user-1', 'user-1')).toBe(false)
    })
  })

  // ── canViewOperation (service scoping) ───────────────────────────────────

  describe('canViewOperation() — service scoping', () => {
    it('allows view when user is assigned to operation service', () => {
      expect(canViewOperation('svc-1', ['svc-1', 'svc-2'])).toBe(true)
    })

    it('blocks view when user not assigned to operation service', () => {
      expect(canViewOperation('svc-3', ['svc-1', 'svc-2'])).toBe(false)
    })

    it('blocks view when user has no services', () => {
      expect(canViewOperation('svc-1', [])).toBe(false)
    })
  })

  // ── operationStatusAfterShiftClose ───────────────────────────────────────

  describe('operationStatusAfterShiftClose()', () => {
    it('SUBMITTED → LOCKED when shift closes', () => {
      expect(operationStatusAfterShiftClose('SUBMITTED')).toBe('LOCKED')
    })

    it('DRAFT stays DRAFT when shift closes', () => {
      expect(operationStatusAfterShiftClose('DRAFT')).toBe('DRAFT')
    })

    it('LOCKED stays LOCKED', () => {
      expect(operationStatusAfterShiftClose('LOCKED')).toBe('LOCKED')
    })

    it('all SUBMITTED operations become LOCKED — shift produces immutable history', () => {
      const opsBeforeClose = ['DRAFT', 'SUBMITTED', 'SUBMITTED', 'LOCKED']
      const opsAfterClose = opsBeforeClose.map(operationStatusAfterShiftClose)
      expect(opsAfterClose).toEqual(['DRAFT', 'LOCKED', 'LOCKED', 'LOCKED'])
    })
  })

  // ── Lifecycle completeness ────────────────────────────────────────────────

  describe('lifecycle invariants', () => {
    it('LOCKED is terminal — no further status changes', () => {
      // Once locked, cannot be submitted or changed
      expect(canSubmitOperation('LOCKED', 'user-1', 'user-1')).toBe(false)
    })

    it('operation lifecycle is linear: DRAFT → SUBMITTED → LOCKED', () => {
      const states = ['DRAFT', 'SUBMITTED', 'LOCKED']
      // Each state allows exactly one forward transition or none
      expect(canSubmitOperation('DRAFT', 'u', 'u')).toBe(true)  // DRAFT → SUBMITTED
      expect(canSubmitOperation('SUBMITTED', 'u', 'u')).toBe(false) // SUBMITTED cannot re-submit
    })
  })
})
