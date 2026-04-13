import {
  canTransition,
  assertTransition,
  nextStatuses,
  isTerminal,
  ALLOWED_TRANSITIONS,
  IncidentStatus,
} from './incident-state-machine'

describe('Incident State Machine', () => {

  // ── canTransition ──────────────────────────────────────────────────────────

  describe('canTransition()', () => {
    describe('valid transitions', () => {
      const validCases: [IncidentStatus, IncidentStatus][] = [
        ['DRAFT',     'ACTIVE'],
        ['ACTIVE',    'ESCALATED'],
        ['ACTIVE',    'RESOLVED'],
        ['ESCALATED', 'RESOLVED'],
        ['RESOLVED',  'ARCHIVED'],
      ]

      test.each(validCases)('%s → %s should be allowed', (from, to) => {
        expect(canTransition(from, to)).toBe(true)
      })
    })

    describe('invalid transitions', () => {
      const invalidCases: [IncidentStatus, IncidentStatus][] = [
        // Cannot skip states
        ['DRAFT',     'RESOLVED'],
        ['DRAFT',     'ESCALATED'],
        ['DRAFT',     'ARCHIVED'],
        // Cannot go backwards
        ['ACTIVE',    'DRAFT'],
        ['ESCALATED', 'ACTIVE'],
        ['ESCALATED', 'DRAFT'],
        ['RESOLVED',  'ACTIVE'],
        ['RESOLVED',  'ESCALATED'],
        ['RESOLVED',  'DRAFT'],
        // ARCHIVED is terminal
        ['ARCHIVED',  'DRAFT'],
        ['ARCHIVED',  'ACTIVE'],
        ['ARCHIVED',  'ESCALATED'],
        ['ARCHIVED',  'RESOLVED'],
        // Self-transitions not allowed
        ['ACTIVE',    'ACTIVE'],
        ['ESCALATED', 'ESCALATED'],
        ['RESOLVED',  'RESOLVED'],
      ]

      test.each(invalidCases)('%s → %s should NOT be allowed', (from, to) => {
        expect(canTransition(from, to)).toBe(false)
      })
    })

    it('critical: DRAFT cannot go directly to RESOLVED (must be ACTIVE first)', () => {
      expect(canTransition('DRAFT', 'RESOLVED')).toBe(false)
    })

    it('critical: cannot resolve from ARCHIVED', () => {
      expect(canTransition('ARCHIVED', 'RESOLVED')).toBe(false)
    })
  })

  // ── assertTransition ───────────────────────────────────────────────────────

  describe('assertTransition()', () => {
    it('does not throw for valid transition', () => {
      expect(() => assertTransition('ACTIVE', 'ESCALATED')).not.toThrow()
    })

    it('throws with descriptive message for invalid transition', () => {
      expect(() => assertTransition('DRAFT', 'RESOLVED')).toThrow(
        'Invalid transition: DRAFT → RESOLVED'
      )
    })

    it('error message includes allowed transitions', () => {
      expect(() => assertTransition('DRAFT', 'ARCHIVED')).toThrow('ACTIVE')
    })

    it('throws for ARCHIVED → anything', () => {
      const statuses: IncidentStatus[] = ['DRAFT', 'ACTIVE', 'ESCALATED', 'RESOLVED']
      statuses.forEach((to) => {
        expect(() => assertTransition('ARCHIVED', to)).toThrow()
      })
    })
  })

  // ── nextStatuses ───────────────────────────────────────────────────────────

  describe('nextStatuses()', () => {
    it('DRAFT can only go to ACTIVE', () => {
      expect(nextStatuses('DRAFT')).toEqual(['ACTIVE'])
    })

    it('ACTIVE can go to ESCALATED or RESOLVED', () => {
      expect(nextStatuses('ACTIVE')).toContain('ESCALATED')
      expect(nextStatuses('ACTIVE')).toContain('RESOLVED')
      expect(nextStatuses('ACTIVE')).toHaveLength(2)
    })

    it('ESCALATED can only go to RESOLVED', () => {
      expect(nextStatuses('ESCALATED')).toEqual(['RESOLVED'])
    })

    it('RESOLVED can only go to ARCHIVED', () => {
      expect(nextStatuses('RESOLVED')).toEqual(['ARCHIVED'])
    })

    it('ARCHIVED has no next statuses', () => {
      expect(nextStatuses('ARCHIVED')).toEqual([])
    })
  })

  // ── isTerminal ─────────────────────────────────────────────────────────────

  describe('isTerminal()', () => {
    it('ARCHIVED is terminal', () => {
      expect(isTerminal('ARCHIVED')).toBe(true)
    })

    it('non-terminal statuses return false', () => {
      const nonTerminal: IncidentStatus[] = ['DRAFT', 'ACTIVE', 'ESCALATED', 'RESOLVED']
      nonTerminal.forEach((s) => {
        expect(isTerminal(s)).toBe(false)
      })
    })
  })

  // ── ALLOWED_TRANSITIONS completeness ───────────────────────────────────────

  describe('ALLOWED_TRANSITIONS completeness', () => {
    const allStatuses: IncidentStatus[] = ['DRAFT', 'ACTIVE', 'ESCALATED', 'RESOLVED', 'ARCHIVED']

    it('every status has an entry in ALLOWED_TRANSITIONS', () => {
      allStatuses.forEach((s) => {
        expect(ALLOWED_TRANSITIONS).toHaveProperty(s)
      })
    })

    it('all transition targets are valid statuses', () => {
      Object.entries(ALLOWED_TRANSITIONS).forEach(([, targets]) => {
        targets.forEach((target) => {
          expect(allStatuses).toContain(target)
        })
      })
    })

    it('no status transitions to itself', () => {
      allStatuses.forEach((s) => {
        expect(ALLOWED_TRANSITIONS[s]).not.toContain(s)
      })
    })
  })

})
