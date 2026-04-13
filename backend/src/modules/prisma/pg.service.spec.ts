// PgService — integration tests against real PostgreSQL
// These test the actual SQL queries, not just the API layer.
// Run requires: DATABASE_URL pointing to a real opsboard DB with seed data.

import { PgService } from './pg.service'

// ── Test bootstrap ─────────────────────────────────────────────────────────

let pg: PgService
let testOrgId: string
let testProjId: string
let testDeptId: string
let testUserId: string
let testServiceId: string
let testZoneId: string
let testShiftId: string

beforeAll(async () => {
  pg = new PgService()
  await pg.onModuleInit()

  // Fetch IDs from seed data (created by seed.ts)
  const [org] = await pg.query('SELECT id FROM "Organization" LIMIT 1')
  testOrgId = org?.id
  if (!testOrgId) throw new Error('No seed data — run seed.ts first')

  const [proj] = await pg.query('SELECT id FROM "Project" LIMIT 1')
  testProjId = proj?.id

  const [dept] = await pg.query('SELECT id FROM "Department" LIMIT 1')
  testDeptId = dept?.id

  const [user] = await pg.query(
    'SELECT id FROM "User" WHERE role=\'COORDINATOR\' LIMIT 1'
  )
  testUserId = user?.id

  const [svc] = await pg.query('SELECT id FROM "Service" LIMIT 1')
  testServiceId = svc?.id

  const [zone] = await pg.query('SELECT id FROM "Zone" LIMIT 1')
  testZoneId = zone?.id

  const [shift] = await pg.query('SELECT id FROM "Shift" LIMIT 1')
  testShiftId = shift?.id
})

afterAll(async () => {
  await cleanup()
  await pg.onModuleDestroy()
})

// ── Cleanup helpers ────────────────────────────────────────────────────────

async function cleanup() {
  await pg.execute('DELETE FROM "AuditEvent" WHERE "entityType"=\'__test__\'')
  await pg.execute('DELETE FROM "IncidentNote" WHERE body LIKE \'__test__%\'')
  await pg.execute('DELETE FROM "Incident" WHERE title LIKE \'__test__%\'')
  await pg.execute('DELETE FROM "Operation" WHERE notes LIKE \'__test__%\'')
  await pg.execute('DELETE FROM "User" WHERE email LIKE \'__test__%\'')
  await pg.execute('DELETE FROM "Zone" WHERE name LIKE \'__test__%\'')
}

beforeEach(cleanup)
// ── user ───────────────────────────────────────────────────────────────────

describe('PgService.user', () => {
  describe('findUnique()', () => {
    it('finds user by email', async () => {
      const user = await pg.user.findUnique({ where: { email: 'admin@opsboard.local' } })
      expect(user).not.toBeNull()
      expect(user.email).toBe('admin@opsboard.local')
    })

    it('finds user by id', async () => {
      const user = await pg.user.findUnique({ where: { id: testUserId } })
      expect(user).not.toBeNull()
      expect(user.id).toBe(testUserId)
    })

    it('returns null for nonexistent email', async () => {
      const user = await pg.user.findUnique({ where: { email: 'nobody@nowhere.com' } })
      expect(user).toBeNull()
    })

    it('respects select — excludes unselected fields', async () => {
      const user = await pg.user.findUnique({
        where: { email: 'admin@opsboard.local' },
        select: { id: true, email: true, fullName: true, role: true, isActive: true },
      })
      expect(user).toHaveProperty('id')
      expect(user).toHaveProperty('email')
      expect(user).not.toHaveProperty('passwordHash')
    })
  })

  describe('create()', () => {
    it('creates a new user and returns it', async () => {
      const user = await pg.user.create({
        data: {
          organizationId: testOrgId,
          email: '__test__user@ops.local',
          passwordHash: 'hash',
          fullName: 'Test User',
          role: 'COORDINATOR',
          isActive: true,
        },
      })
      expect(user).toHaveProperty('id')
      expect(user.email).toBe('__test__user@ops.local')
      expect(user.role).toBe('COORDINATOR')
    })

    it('created user can be found by email', async () => {
      await pg.user.create({
        data: {
          organizationId: testOrgId,
          email: '__test__findme@ops.local',
          passwordHash: 'h',
          fullName: 'Find Me',
          role: 'COORDINATOR',
          isActive: true,
        },
      })
      const found = await pg.user.findUnique({ where: { email: '__test__findme@ops.local' } })
      expect(found).not.toBeNull()
      expect(found.fullName).toBe('Find Me')
    })
  })

  describe('update()', () => {
    it('deactivates a user', async () => {
      const created = await pg.user.create({
        data: {
          organizationId: testOrgId,
          email: '__test__deactivate@ops.local',
          passwordHash: 'h',
          fullName: 'Deactivate Me',
          role: 'COORDINATOR',
          isActive: true,
        },
      })
      const updated = await pg.user.update({
        where: { id: created.id },
        data: { isActive: false },
        select: { id: true, isActive: true },
      })
      expect(updated.isActive).toBe(false)
    })
  })

  describe('findMany()', () => {
    it('returns all users in org', async () => {
      const users = await pg.user.findMany({ where: { organizationId: testOrgId } })
      expect(Array.isArray(users)).toBe(true)
      expect(users.length).toBeGreaterThan(0)
    })

    it('excludes passwordHash when select is specified', async () => {
      const users = await pg.user.findMany({
        where: { organizationId: testOrgId },
        select: { id: true, email: true, fullName: true, role: true, isActive: true },
      })
      expect(users.every((u: any) => !('passwordHash' in u))).toBe(true)
    })
  })
})

// ── zone ───────────────────────────────────────────────────────────────────

describe('PgService.zone', () => {
  describe('findMany()', () => {
    it('returns zones for project', async () => {
      const zones = await pg.zone.findMany({ where: { projectId: testProjId } })
      expect(Array.isArray(zones)).toBe(true)
      expect(zones.length).toBeGreaterThan(0)
    })

    it('filters by isActive', async () => {
      const zones = await pg.zone.findMany({ where: { projectId: testProjId, isActive: true } })
      expect(zones.every((z: any) => z.isActive === true)).toBe(true)
    })
  })

  describe('create()', () => {
    it('creates a zone', async () => {
      const zone = await pg.zone.create({
        data: { projectId: testProjId, name: '__test__Zone Alpha', isActive: true },
      })
      expect(zone).toHaveProperty('id')
      expect(zone.name).toBe('__test__Zone Alpha')
    })
  })

  describe('update()', () => {
    it('deactivates a zone', async () => {
      const zone = await pg.zone.create({
        data: { projectId: testProjId, name: '__test__Zone Deactivate', isActive: true },
      })
      const updated = await pg.zone.update({ where: { id: zone.id }, data: { isActive: false } })
      expect(updated.isActive).toBe(false)
    })
  })
})

// ── service ────────────────────────────────────────────────────────────────

describe('PgService.service', () => {
  describe('findMany()', () => {
    it('finds by departmentId string', async () => {
      const svcs = await pg.service.findMany({ where: { departmentId: testDeptId } })
      expect(Array.isArray(svcs)).toBe(true)
      expect(svcs.length).toBeGreaterThan(0)
      expect(svcs.every((s: any) => s.departmentId === testDeptId)).toBe(true)
    })

    it('finds by departmentId.in array', async () => {
      const svcs = await pg.service.findMany({
        where: { departmentId: { in: [testDeptId] } },
      })
      expect(svcs.length).toBeGreaterThan(0)
    })

    it('departmentId string vs in returns same results', async () => {
      const byStr = await pg.service.findMany({ where: { departmentId: testDeptId } })
      const byIn  = await pg.service.findMany({ where: { departmentId: { in: [testDeptId] } } })
      expect(byStr.length).toBe(byIn.length)
    })

    it('returns empty array for unknown departmentId', async () => {
      const svcs = await pg.service.findMany({
        where: { departmentId: { in: ['nonexistent-id'] } },
      })
      expect(svcs).toEqual([])
    })
  })
})

// ── incident ───────────────────────────────────────────────────────────────

describe('PgService.incident', () => {
  let incidentId: string

  beforeEach(async () => {
    const inc = await pg.incident.create({
      data: {
        projectId: testProjId,
        type: 'COMPLAINT',
        title: '__test__Incident',
        status: 'ACTIVE',
        createdById: testUserId,
        syncState: 'SYNCED',
      },
    })
    incidentId = inc.id
  })

  describe('create()', () => {
    it('creates incident with ACTIVE status', async () => {
      const inc = await pg.incident.create({
        data: {
          projectId: testProjId,
          type: 'OTHER',
          title: '__test__Create Test',
          status: 'ACTIVE',
          createdById: testUserId,
          syncState: 'SYNCED',
        },
      })
      expect(inc).toHaveProperty('id')
      expect(inc.status).toBe('ACTIVE')
      expect(inc.syncState).toBe('SYNCED')
    })
  })

  describe('findMany()', () => {
    it('filters by status', async () => {
      const active = await pg.incident.findMany({
        where: { projectId: testProjId, status: 'ACTIVE' },
      })
      expect(active.every((i: any) => i.status === 'ACTIVE')).toBe(true)
    })

    it('returns createdBy embedded', async () => {
      const incs = await pg.incident.findMany({ where: { projectId: testProjId } })
      expect(incs.every((i: any) => i.createdBy && i.createdBy.fullName)).toBe(true)
    })
  })

  describe('findUnique()', () => {
    it('returns incident by id with notes', async () => {
      const inc = await pg.incident.findUnique({
        where: { id: incidentId },
        include: { notes: true },
      })
      expect(inc).not.toBeNull()
      expect(inc!.id).toBe(incidentId)
      expect(Array.isArray(inc!.notes)).toBe(true)
    })

    it('returns null for nonexistent id', async () => {
      const inc = await pg.incident.findUnique({ where: { id: 'bad-id' } })
      expect(inc).toBeNull()
    })
  })

  describe('update()', () => {
    it('updates status to ESCALATED', async () => {
      const updated = await pg.incident.update({
        where: { id: incidentId },
        data: { status: 'ESCALATED' },
      })
      expect(updated.status).toBe('ESCALATED')
    })

    it('updates status to RESOLVED with resolvedById', async () => {
      const updated = await pg.incident.update({
        where: { id: incidentId },
        data: { status: 'RESOLVED', resolvedById: testUserId, resolvedAt: new Date() },
      })
      expect(updated.status).toBe('RESOLVED')
    })
  })
})

// ── incidentNote ───────────────────────────────────────────────────────────

describe('PgService.incidentNote', () => {
  let incidentId: string

  beforeEach(async () => {
    const inc = await pg.incident.create({
      data: {
        projectId: testProjId,
        type: 'OTHER',
        title: '__test__Note Incident',
        status: 'ACTIVE',
        createdById: testUserId,
        syncState: 'SYNCED',
      },
    })
    incidentId = inc.id
  })

  it('creates a note', async () => {
    const note = await pg.incidentNote.create({
      data: { incidentId, authorId: testUserId, body: '__test__First note' },
    })
    expect(note).toHaveProperty('id')
    expect(note.body).toBe('__test__First note')
  })

  it('note appears in findMany', async () => {
    await pg.incidentNote.create({
      data: { incidentId, authorId: testUserId, body: '__test__Findable note' },
    })
    const notes = await pg.incidentNote.findMany({ where: { incidentId } })
    expect(notes.length).toBeGreaterThan(0)
    expect(notes.some((n: any) => n.body === '__test__Findable note')).toBe(true)
  })

  it('notes are returned in chronological order', async () => {
    await pg.incidentNote.create({ data: { incidentId, authorId: testUserId, body: '__test__Note 1' } })
    await pg.incidentNote.create({ data: { incidentId, authorId: testUserId, body: '__test__Note 2' } })
    const notes = await pg.incidentNote.findMany({ where: { incidentId } })
    const bodies = notes.map((n: any) => n.body)
    expect(bodies.indexOf('__test__Note 1')).toBeLessThan(bodies.indexOf('__test__Note 2'))
  })

  it('note includes author', async () => {
    const note = await pg.incidentNote.create({
      data: { incidentId, authorId: testUserId, body: '__test__With author' },
      include: { author: true },
    })
    expect(note.author).toBeDefined()
    expect(note.author.fullName).toBeDefined()
  })
})

// ── operation ──────────────────────────────────────────────────────────────

describe('PgService.operation', () => {
  it('creates operation with DRAFT status', async () => {
    const op = await pg.operation.create({
      data: {
        shiftId: testShiftId,
        serviceId: testServiceId,
        createdById: testUserId,
        notes: '__test__Operation note',
        status: 'DRAFT',
        syncState: 'SYNCED',
      },
    })
    expect(op).toHaveProperty('id')
    expect(op.status).toBe('DRAFT')
  })

  it('updateMany locks SUBMITTED operations', async () => {
    const op = await pg.operation.create({
      data: {
        shiftId: testShiftId,
        serviceId: testServiceId,
        createdById: testUserId,
        notes: '__test__To be locked',
        status: 'SUBMITTED',
        syncState: 'SYNCED',
      },
    })
    await pg.operation.updateMany({
      where: { shiftId: testShiftId, status: 'SUBMITTED' },
      data: { status: 'LOCKED', lockedAt: new Date() },
    })
    const updated = await pg.operation.findUnique({ where: { id: op.id } })
    expect(updated.status).toBe('LOCKED')
  })
})

// ── auditEvent ─────────────────────────────────────────────────────────────

describe('PgService.auditEvent', () => {
  it('creates an audit event', async () => {
    const ev = await pg.auditEvent.create({
      data: {
        entityType: '__test__',
        entityId: 'test-entity-1',
        actorId: testUserId,
        action: 'TEST_ACTION',
        payload: { foo: 'bar' },
      },
    })
    expect(ev).toHaveProperty('id')
    expect(ev.action).toBe('TEST_ACTION')
  })

  it('audit event is queryable', async () => {
    await pg.auditEvent.create({
      data: {
        entityType: '__test__',
        entityId: 'test-entity-2',
        actorId: testUserId,
        action: 'VERIFY_ACTION',
      },
    })
    const rows = await pg.query(
      'SELECT * FROM "AuditEvent" WHERE "entityType"=$1 AND action=$2',
      ['__test__', 'VERIFY_ACTION']
    )
    expect(rows.length).toBeGreaterThan(0)
  })
})
