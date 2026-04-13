import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { Pool, PoolClient } from 'pg'

// PgService replaces PrismaService in local development.
// Uses node-postgres (pure JS) so no binary downloads required.
// API surface mirrors what our modules actually call on prisma.*

@Injectable()
export class PgService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PgService')
  private pool: Pool

  async onModuleInit() {
    this.pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ??
        'postgresql://opsboard:opsboard123@localhost:5432/opsboard',
    })
    // Verify connection
    const client = await this.pool.connect()
    const { rows } = await client.query('SELECT version()')
    client.release()
    this.logger.log(`Connected: ${rows[0].version.slice(0, 40)}`)
  }

  async onModuleDestroy() {
    await this.pool?.end()
  }

  // ── Raw query helpers ──────────────────────────────────────────────────────

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const { rows } = await this.pool.query(sql, params)
    return rows as T[]
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params)
    return rows.length > 0 ? rows[0] : null
  }

  async execute(sql: string, params: any[] = []): Promise<number> {
    const { rowCount } = await this.pool.query(sql, params)
    return rowCount ?? 0
  }

  // ── Transaction helper ─────────────────────────────────────────────────────

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  // ── Prisma-compatible namespaced accessors ─────────────────────────────────
  // These mirror the prisma.user.findUnique(…) call patterns our services use
  // so we can swap PgService in without rewriting every module.

  readonly user = {
    findUnique: async ({ where, select }: any) => {
      let row: any = null
      if (where.email) {
        const rows = await this.query('SELECT * FROM "User" WHERE email=$1', [where.email])
        row = rows[0] ?? null
      } else if (where.id) {
        const rows = await this.query('SELECT * FROM "User" WHERE id=$1', [where.id])
        row = rows[0] ?? null
      }
      if (!row) return null
      if (!select) return row
      return this.applySelect(row, select)
    },
    findMany: async ({ where, select, orderBy }: any = {}) => {
      const { clause, params } = this.buildWhere(where, '"User"')
      const rows = await this.query(`SELECT * FROM "User" ${clause}`, params)
      return select ? rows.map((r: any) => this.applySelect(r, select)) : rows
    },
    create: async ({ data, select }: any) => {
      const id = require('crypto').randomUUID()
      const row = await this.queryOne(`
        INSERT INTO "User"(id,"organizationId",email,"passwordHash","fullName",role,"isActive")
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [id, data.organizationId, data.email, data.passwordHash, data.fullName, data.role ?? 'COORDINATOR', data.isActive ?? true]
      )
      return select ? this.applySelect(row, select) : row
    },
    update: async ({ where, data, select }: any) => {
      const sets = Object.keys(data)
        .map((k, i) => `"${k}"=$${i + 2}`)
        .join(',')
      const vals = Object.values(data)
      const row = await this.queryOne(
        `UPDATE "User" SET ${sets} WHERE id=$1 RETURNING *`,
        [where.id, ...vals]
      )
      return select ? this.applySelect(row, select) : row
    },
  }

  readonly organization = {
    findFirst: async ({ where }: any) => {
      const { clause, params } = this.buildWhere(where, '"Organization"')
      return this.queryOne(`SELECT * FROM "Organization" ${clause}`, params)
    },
  }

  readonly project = {
    findFirst: async ({ where, select }: any) => {
      const { clause, params } = this.buildWhere(where, '"Project"')
      const row = await this.queryOne(`SELECT * FROM "Project" ${clause}`, params)
      return row && select ? this.applySelect(row, select) : row
    },
  }

  readonly department = {
    findFirst: async ({ where, select }: any) => {
      const { clause, params } = this.buildWhere(where, '"Department"')
      const row = await this.queryOne(`SELECT * FROM "Department" ${clause}`, params)
      return row && select ? this.applySelect(row, select) : row
    },
    findMany: async ({ where }: any = {}) => {
      const { clause, params } = this.buildWhere(where, '"Department"')
      return this.query(`SELECT * FROM "Department" ${clause}`, params)
    },
  }

  readonly zone = {
    findMany: async ({ where, orderBy }: any = {}) => {
      const conds: string[] = []
      const params: any[] = []
      if (where?.projectId) { params.push(where.projectId); conds.push(`"projectId"=$${params.length}`) }
      if (where?.isActive !== undefined) { params.push(where.isActive); conds.push(`"isActive"=$${params.length}`) }
      const clause = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
      return this.query(`SELECT * FROM "Zone" ${clause} ORDER BY name ASC`, params)
    },
    create: async ({ data }: any) => {
      const id = require('crypto').randomUUID()
      return this.queryOne(
        `INSERT INTO "Zone"(id,"projectId",name,description,"isActive") VALUES($1,$2,$3,$4,$5) RETURNING *`,
        [id, data.projectId, data.name, data.description ?? null, data.isActive ?? true]
      )
    },
    update: async ({ where, data }: any) => {
      const sets = Object.keys(data).map((k, i) => `"${k}"=$${i + 2}`).join(',')
      return this.queryOne(
        `UPDATE "Zone" SET ${sets} WHERE id=$1 RETURNING *`,
        [where.id, ...Object.values(data)]
      )
    },
  }

  readonly service = {
    findMany: async ({ where, orderBy }: any = {}) => {
      const conds: string[] = []
      const params: any[] = []
      if (where?.departmentId?.in) {
        // { departmentId: { in: [...] } }
        params.push(where.departmentId.in)
        conds.push(`"departmentId" = ANY($${params.length})`)
      } else if (where?.departmentId) {
        // { departmentId: 'literal-id' }
        params.push(where.departmentId)
        conds.push(`"departmentId"=$${params.length}`)
      }
      if (where?.isActive !== undefined) { params.push(where.isActive); conds.push(`"isActive"=$${params.length}`) }
      const clause = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
      return this.query(`SELECT * FROM "Service" ${clause} ORDER BY name ASC`, params)
    },
    create: async ({ data }: any) => {
      const id = require('crypto').randomUUID()
      return this.queryOne(
        `INSERT INTO "Service"(id,"departmentId",name,description,"isActive") VALUES($1,$2,$3,$4,$5) RETURNING *`,
        [id, data.departmentId, data.name, data.description ?? null, data.isActive ?? true]
      )
    },
    update: async ({ where, data }: any) => {
      const sets = Object.keys(data).map((k, i) => `"${k}"=$${i + 2}`).join(',')
      return this.queryOne(
        `UPDATE "Service" SET ${sets} WHERE id=$1 RETURNING *`,
        [where.id, ...Object.values(data)]
      )
    },
  }

  readonly userService = {
    findMany: async ({ where, include }: any) => {
      const rows = await this.query(
        `SELECT us.*, s.id AS "sId", s.name AS "sName", s."isActive" AS "sActive"
         FROM "UserService" us JOIN "Service" s ON s.id=us."serviceId"
         WHERE us."userId"=$1`,
        [where.userId]
      )
      return rows.map((r: any) => ({
        userId: r.userId,
        serviceId: r.serviceId,
        service: include?.service ? { id: r.sId, name: r.sName, isActive: r.sActive } : undefined,
      }))
    },
    upsert: async ({ where, create }: any) => {
      await this.execute(
        `INSERT INTO "UserService"("userId","serviceId") VALUES($1,$2) ON CONFLICT DO NOTHING`,
        [where.userId_serviceId.userId, where.userId_serviceId.serviceId]
      )
    },
  }

  readonly shift = {
    findFirst: async ({ where, include }: any) => {
      const conds: string[] = []
      const params: any[] = []
      if (where?.departmentId) { params.push(where.departmentId); conds.push(`s."departmentId"=$${params.length}`) }
      if (where?.status) { params.push(where.status); conds.push(`s.status::text=$${params.length}`) }
      if (where?.id) { params.push(where.id); conds.push(`s.id=$${params.length}`) }
      const clause = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
      const row = await this.queryOne(
        `SELECT s.*, u."fullName" AS "openedByFullName" FROM "Shift" s
         LEFT JOIN "User" u ON u.id=s."openedById" ${clause} LIMIT 1`,
        params
      )
      if (!row) return null
      if (include?.openedBy) row.openedBy = row.openedByFullName ? { id: row.openedById, fullName: row.openedByFullName } : null
      return row
    },
    findUnique: async ({ where }: any) => {
      return this.queryOne(`SELECT * FROM "Shift" WHERE id=$1`, [where.id])
    },
    findMany: async ({ where, include, orderBy }: any = {}) => {
      const conds: string[] = []
      const params: any[] = []
      if (where?.departmentId) { params.push(where.departmentId); conds.push(`s."departmentId"=$${params.length}`) }
      const clause = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
      const rows = await this.query(
        `SELECT s.*, u."fullName" AS "openedByFullName", u.id AS "openedByUserId"
         FROM "Shift" s LEFT JOIN "User" u ON u.id=s."openedById"
         ${clause} ORDER BY s."startsAt" DESC`,
        params
      )
      return rows.map((r: any) => ({
        ...r,
        openedBy: r.openedByFullName ? { id: r.openedByUserId, fullName: r.openedByFullName } : null,
      }))
    },
    create: async ({ data }: any) => {
      const id = require('crypto').randomUUID()
      return this.queryOne(
        `INSERT INTO "Shift"(id,"projectId","departmentId",name,status,"startsAt") VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, data.projectId, data.departmentId, data.name, data.status ?? 'PLANNED', data.startsAt ?? new Date()]
      )
    },
    update: async ({ where, data }: any) => {
      const map: Record<string, string> = {
        openedById: '"openedById"', closedById: '"closedById"',
        openedAt: '"openedAt"', closedAt: '"closedAt"', endsAt: '"endsAt"',
        status: 'status',
      }
      const sets = Object.keys(data).map((k, i) => `${map[k] ?? `"${k}"`}=$${i + 2}`).join(',')
      return this.queryOne(
        `UPDATE "Shift" SET ${sets} WHERE id=$1 RETURNING *`,
        [where.id, ...Object.values(data)]
      )
    },
  }

  readonly incident = {
    findMany: async ({ where, include, orderBy }: any = {}) => {
      const conds: string[] = []
      const params: any[] = []
      if (where?.projectId) { params.push(where.projectId); conds.push(`i."projectId"=$${params.length}`) }
      if (where?.status) { params.push(where.status); conds.push(`i.status::text=$${params.length}`) }
      const clause = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
      const rows = await this.query(`
        SELECT i.*,
          z.id AS "zId", z.name AS "zName",
          s.id AS "sId", s.name AS "sName",
          u.id AS "uId", u."fullName" AS "uName",
          ru.id AS "ruId", ru."fullName" AS "ruName"
        FROM "Incident" i
        LEFT JOIN "Zone" z ON z.id=i."zoneId"
        LEFT JOIN "Service" s ON s.id=i."serviceId"
        JOIN "User" u ON u.id=i."createdById"
        LEFT JOIN "User" ru ON ru.id=i."resolvedById"
        ${clause}
        ORDER BY CASE i.status::text WHEN 'ESCALATED' THEN 0 ELSE 1 END, i."createdAt" DESC`,
        params
      )
      return rows.map(this.mapIncident)
    },
    findUnique: async ({ where, include }: any) => {
      const row = await this.queryOne(`
        SELECT i.*,
          z.id AS "zId", z.name AS "zName",
          s.id AS "sId", s.name AS "sName",
          u.id AS "uId", u."fullName" AS "uName",
          ru.id AS "ruId", ru."fullName" AS "ruName"
        FROM "Incident" i
        LEFT JOIN "Zone" z ON z.id=i."zoneId"
        LEFT JOIN "Service" s ON s.id=i."serviceId"
        JOIN "User" u ON u.id=i."createdById"
        LEFT JOIN "User" ru ON ru.id=i."resolvedById"
        WHERE i.id=$1`, [where.id]
      )
      if (!row) return null
      const mapped = this.mapIncident(row)
      if (include?.notes) {
        mapped.notes = await this.incidentNote.findMany({ where: { incidentId: where.id }, include: { author: true } })
      }
      return mapped
    },
    create: async ({ data }: any) => {
      const id = require('crypto').randomUUID()
      return this.queryOne(`
        INSERT INTO "Incident"(id,"projectId","zoneId","serviceId","createdById",type,status,title,description,"syncState")
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [id, data.projectId, data.zoneId ?? null, data.serviceId ?? null,
         data.createdById, data.type, data.status ?? 'ACTIVE', data.title,
         data.description ?? null, data.syncState ?? 'SYNCED']
      )
    },
    update: async ({ where, data }: any) => {
      const cols: Record<string, string> = {
        status: 'status', resolvedById: '"resolvedById"',
        resolvedAt: '"resolvedAt"', archivedAt: '"archivedAt"',
      }
      const sets = Object.keys(data).map((k, i) => `${cols[k] ?? `"${k}"`}=$${i + 2}`).join(',')
      return this.queryOne(
        `UPDATE "Incident" SET ${sets} WHERE id=$1 RETURNING *`,
        [where.id, ...Object.values(data)]
      )
    },
  }

  readonly incidentNote = {
    findMany: async ({ where, include, orderBy }: any = {}) => {
      const rows = await this.query(`
        SELECT n.*, u.id AS "aId", u."fullName" AS "aName"
        FROM "IncidentNote" n JOIN "User" u ON u.id=n."authorId"
        WHERE n."incidentId"=$1 ORDER BY n."createdAt" ASC`,
        [where.incidentId]
      )
      return rows.map((r: any) => ({
        id: r.id, body: r.body, createdAt: r.createdAt, incidentId: r.incidentId,
        author: { id: r.aId, fullName: r.aName },
      }))
    },
    create: async ({ data, include }: any) => {
      const id = require('crypto').randomUUID()
      const row = await this.queryOne(
        `INSERT INTO "IncidentNote"(id,"incidentId","authorId",body) VALUES($1,$2,$3,$4) RETURNING *`,
        [id, data.incidentId, data.authorId, data.body]
      )
      if (include?.author) {
        const author = await this.user.findUnique({ where: { id: data.authorId } })
        row.author = { id: author?.id, fullName: author?.fullName }
      }
      return row
    },
  }

  readonly operation = {
    findMany: async ({ where, include }: any = {}) => {
      const conds: string[] = []
      const params: any[] = []
      if (where?.shiftId) { params.push(where.shiftId); conds.push(`o."shiftId"=$${params.length}`) }
      if (where?.serviceId?.in) { params.push(where.serviceId.in); conds.push(`o."serviceId" = ANY($${params.length})`) }
      const clause = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
      const rows = await this.query(`
        SELECT o.*, s.id AS "sId", s.name AS "sName",
          z.id AS "zId", z.name AS "zName",
          u.id AS "uId", u."fullName" AS "uName"
        FROM "Operation" o
        JOIN "Service" s ON s.id=o."serviceId"
        LEFT JOIN "Zone" z ON z.id=o."zoneId"
        JOIN "User" u ON u.id=o."createdById"
        ${clause} ORDER BY o."createdAt" DESC`,
        params
      )
      return rows.map((r: any) => ({
        ...r,
        service: { id: r.sId, name: r.sName },
        zone: r.zId ? { id: r.zId, name: r.zName } : null,
        createdBy: { id: r.uId, fullName: r.uName },
      }))
    },
    findUnique: async ({ where }: any) => {
      return this.queryOne(`SELECT * FROM "Operation" WHERE id=$1`, [where.id])
    },
    create: async ({ data }: any) => {
      const id = require('crypto').randomUUID()
      return this.queryOne(`
        INSERT INTO "Operation"(id,"shiftId","serviceId","zoneId","createdById",status,notes,"syncState")
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [id, data.shiftId, data.serviceId, data.zoneId ?? null,
         data.createdById, data.status ?? 'DRAFT', data.notes ?? null, data.syncState ?? 'SYNCED']
      )
    },
    update: async ({ where, data }: any) => {
      const sets = Object.keys(data).map((k, i) => `"${k}"=$${i + 2}`).join(',')
      return this.queryOne(
        `UPDATE "Operation" SET ${sets} WHERE id=$1 RETURNING *`,
        [where.id, ...Object.values(data)]
      )
    },
    updateMany: async ({ where, data }: any) => {
      const conds: string[] = []
      const params: any[] = []
      if (where?.shiftId) { params.push(where.shiftId); conds.push(`"shiftId"=$${params.length}`) }
      if (where?.status) { params.push(where.status); conds.push(`status::text=$${params.length}`) }
      const sets = Object.keys(data).map((k, i) => `"${k}"=$${params.length + i + 1}`).join(',')
      const { rowCount } = await this.pool.query(
        `UPDATE "Operation" SET ${sets} WHERE ${conds.join(' AND ')}`,
        [...params, ...Object.values(data)]
      )
      return { count: rowCount }
    },
  }

  readonly auditEvent = {
    create: async ({ data }: any) => {
      const id = require('crypto').randomUUID()
      return this.queryOne(
        `INSERT INTO "AuditEvent"(id,"entityType","entityId","actorId",action,payload) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, data.entityType, data.entityId, data.actorId, data.action, data.payload ?? null]
      )
    },
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private applySelect(row: any, select: Record<string, boolean>): any {
    if (!row) return null
    const out: any = {}
    for (const key of Object.keys(select)) {
      if (select[key] && row[key] !== undefined) out[key] = row[key]
    }
    return out
  }

  private buildWhere(where: any = {}, table: string): { clause: string; params: any[] } {
    const conds: string[] = []
    const params: any[] = []
    const COL_MAP: Record<string, string> = {
      organizationId: '"organizationId"',
      isActive: '"isActive"',
      projectId: '"projectId"',
      departmentId: '"departmentId"',
      id: 'id',
      email: 'email',
      status: 'status',
    }
    for (const [k, v] of Object.entries(where)) {
      const col = COL_MAP[k] ?? `"${k}"`
      params.push(v)
      conds.push(`${col}=$${params.length}`)
    }
    return { clause: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params }
  }

  private mapIncident(r: any) {
    return {
      id: r.id, type: r.type, status: r.status, title: r.title,
      description: r.description, syncState: r.syncState,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
      notes: [] as any[],
      zone:      r.zId ? { id: r.zId, name: r.zName } : null,
      service:   r.sId ? { id: r.sId, name: r.sName } : null,
      createdBy: { id: r.uId, fullName: r.uName },
      resolvedBy: r.ruId ? { id: r.ruId, fullName: r.ruName } : null,
    }
  }

  // ── $connect / $disconnect for NestJS lifecycle ───────────────────────────
  async $connect() {}
  async $disconnect() { await this.pool?.end() }
}

export { PgService as PrismaService }
