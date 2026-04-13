// Context module — tests the data assembly logic
// Context = user + project + department + active shift + assigned services
// This is what every frontend screen uses to know "who am I and what shift am I in"

describe('Context Assembly Rules', () => {

  // Pure logic — what context should contain
  function buildContext(
    user: { id: string; role: string; organizationId: string },
    project: { id: string; name: string } | null,
    department: { id: string; name: string } | null,
    activeShift: { id: string; name: string; status: string } | null,
    assignedServices: { id: string; name: string; isActive: boolean }[],
  ) {
    return {
      user: { id: user.id, role: user.role },
      project,
      department,
      activeShift: activeShift?.status === 'ACTIVE' ? activeShift : null,
      assignedServices: assignedServices.filter(s => s.isActive),
    }
  }

  describe('active shift filtering', () => {
    it('returns active shift when status is ACTIVE', () => {
      const ctx = buildContext(
        { id: 'u1', role: 'COORDINATOR', organizationId: 'o1' },
        { id: 'p1', name: 'WUF13' },
        { id: 'd1', name: 'Guest Services' },
        { id: 's1', name: 'Morning Shift', status: 'ACTIVE' },
        [],
      )
      expect(ctx.activeShift).not.toBeNull()
      expect(ctx.activeShift?.name).toBe('Morning Shift')
    })

    it('returns null when shift is PLANNED', () => {
      const ctx = buildContext(
        { id: 'u1', role: 'COORDINATOR', organizationId: 'o1' },
        { id: 'p1', name: 'WUF13' },
        { id: 'd1', name: 'Guest Services' },
        { id: 's1', name: 'Morning Shift', status: 'PLANNED' },
        [],
      )
      expect(ctx.activeShift).toBeNull()
    })

    it('returns null when shift is CLOSED', () => {
      const ctx = buildContext(
        { id: 'u1', role: 'COORDINATOR', organizationId: 'o1' },
        { id: 'p1', name: 'WUF13' },
        { id: 'd1', name: 'Guest Services' },
        { id: 's1', name: 'Morning Shift', status: 'CLOSED' },
        [],
      )
      expect(ctx.activeShift).toBeNull()
    })

    it('returns null when no shift exists', () => {
      const ctx = buildContext(
        { id: 'u1', role: 'COORDINATOR', organizationId: 'o1' },
        { id: 'p1', name: 'WUF13' },
        { id: 'd1', name: 'Guest Services' },
        null,
        [],
      )
      expect(ctx.activeShift).toBeNull()
    })
  })

  describe('assigned services filtering', () => {
    it('only returns active services', () => {
      const ctx = buildContext(
        { id: 'u1', role: 'COORDINATOR', organizationId: 'o1' },
        { id: 'p1', name: 'WUF13' },
        null, null,
        [
          { id: 's1', name: 'Info Desk', isActive: true },
          { id: 's2', name: 'Old Service', isActive: false },
          { id: 's3', name: 'Transport', isActive: true },
        ],
      )
      expect(ctx.assignedServices).toHaveLength(2)
      expect(ctx.assignedServices.map(s => s.id)).toEqual(['s1', 's3'])
    })

    it('returns empty array when no services assigned', () => {
      const ctx = buildContext(
        { id: 'u1', role: 'COORDINATOR', organizationId: 'o1' },
        null, null, null, [],
      )
      expect(ctx.assignedServices).toEqual([])
    })
  })

  describe('context completeness', () => {
    it('always contains user data', () => {
      const ctx = buildContext(
        { id: 'u1', role: 'ADMIN', organizationId: 'o1' },
        null, null, null, [],
      )
      expect(ctx.user).toHaveProperty('id')
      expect(ctx.user).toHaveProperty('role')
    })

    it('project null when no active project', () => {
      const ctx = buildContext(
        { id: 'u1', role: 'COORDINATOR', organizationId: 'o1' },
        null, null, null, [],
      )
      expect(ctx.project).toBeNull()
    })

    it('full context with all fields populated', () => {
      const ctx = buildContext(
        { id: 'u1', role: 'COORDINATOR', organizationId: 'o1' },
        { id: 'p1', name: 'WUF13' },
        { id: 'd1', name: 'Guest Services' },
        { id: 'sh1', name: 'Morning Shift', status: 'ACTIVE' },
        [{ id: 'svc1', name: 'Info Desk', isActive: true }],
      )
      expect(ctx.user.id).toBe('u1')
      expect(ctx.project?.name).toBe('WUF13')
      expect(ctx.department?.name).toBe('Guest Services')
      expect(ctx.activeShift?.name).toBe('Morning Shift')
      expect(ctx.assignedServices).toHaveLength(1)
    })
  })
})
