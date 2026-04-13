// Admin module — role access control rules
// Tests the permission boundaries without touching the DB

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SENIOR_MANAGER']
const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SENIOR_MANAGER', 'SERVICE_MANAGER', 'COORDINATOR']

function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role)
}

function canManageUsers(role: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN'].includes(role)
}

function canManageZones(role: string): boolean {
  return ADMIN_ROLES.includes(role)
}

function canManageServices(role: string): boolean {
  return ADMIN_ROLES.includes(role)
}

function canViewAdminPanel(role: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'SENIOR_MANAGER', 'SERVICE_MANAGER'].includes(role)
}

describe('Admin Role Access Control', () => {

  describe('isAdminRole()', () => {
    test.each(['SUPER_ADMIN', 'ADMIN', 'SENIOR_MANAGER'])(
      '%s has admin access', (role) => {
        expect(isAdminRole(role)).toBe(true)
      }
    )

    test.each(['SERVICE_MANAGER', 'COORDINATOR', '', 'UNKNOWN'])(
      '%s does NOT have admin access', (role) => {
        expect(isAdminRole(role)).toBe(false)
      }
    )
  })

  describe('canManageUsers()', () => {
    it('SUPER_ADMIN can manage users', () => {
      expect(canManageUsers('SUPER_ADMIN')).toBe(true)
    })

    it('ADMIN can manage users', () => {
      expect(canManageUsers('ADMIN')).toBe(true)
    })

    it('SENIOR_MANAGER cannot manage users', () => {
      expect(canManageUsers('SENIOR_MANAGER')).toBe(false)
    })

    it('COORDINATOR cannot manage users', () => {
      expect(canManageUsers('COORDINATOR')).toBe(false)
    })
  })

  describe('canManageZones()', () => {
    test.each(['SUPER_ADMIN', 'ADMIN', 'SENIOR_MANAGER'])(
      '%s can manage zones', (role) => {
        expect(canManageZones(role)).toBe(true)
      }
    )

    test.each(['SERVICE_MANAGER', 'COORDINATOR'])(
      '%s cannot manage zones', (role) => {
        expect(canManageZones(role)).toBe(false)
      }
    )
  })

  describe('canViewAdminPanel()', () => {
    test.each(['SUPER_ADMIN', 'ADMIN', 'SENIOR_MANAGER', 'SERVICE_MANAGER'])(
      '%s can view admin panel', (role) => {
        expect(canViewAdminPanel(role)).toBe(true)
      }
    )

    it('COORDINATOR cannot view admin panel', () => {
      expect(canViewAdminPanel('COORDINATOR')).toBe(false)
    })
  })

  describe('role hierarchy is consistent', () => {
    it('all user managers are also admin-role holders', () => {
      const userManagers = ALL_ROLES.filter(canManageUsers)
      userManagers.forEach(role => {
        expect(isAdminRole(role)).toBe(true)
      })
    })

    it('zone managers ⊆ admin panel viewers', () => {
      const zoneManagers = ALL_ROLES.filter(canManageZones)
      zoneManagers.forEach(role => {
        expect(canViewAdminPanel(role)).toBe(true)
      })
    })

    it('COORDINATOR is excluded from all admin operations', () => {
      expect(isAdminRole('COORDINATOR')).toBe(false)
      expect(canManageUsers('COORDINATOR')).toBe(false)
      expect(canManageZones('COORDINATOR')).toBe(false)
      expect(canManageServices('COORDINATOR')).toBe(false)
      expect(canViewAdminPanel('COORDINATOR')).toBe(false)
    })
  })
})
