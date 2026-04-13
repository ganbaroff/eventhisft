// OPSBOARD — Seed script
// Idempotent: safe to run multiple times.
// Uses pg directly (no Prisma binary needed).
// Run: npx ts-node prisma/seed.ts

import * as bcrypt from 'bcryptjs'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://opsboard:opsboard123@localhost:5432/opsboard',
})

async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const { rows } = await pool.query(sql, params)
  return rows as T[]
}

async function findOrCreate<T = any>(
  table: string,
  where: Record<string, any>,
  data: Record<string, any>
): Promise<T> {
  const whereCols = Object.keys(where)
  const whereSql = whereCols.map((k, i) => `"${k}"=$${i + 1}`).join(' AND ')
  const [existing] = await q<T>(`SELECT * FROM "${table}" WHERE ${whereSql}`, Object.values(where))
  if (existing) return existing
  const cols = Object.keys(data).map(k => `"${k}"`).join(',')
  const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(',')
  const [created] = await q<T>(
    `INSERT INTO "${table}"(${cols}) VALUES(${placeholders}) RETURNING *`,
    Object.values(data)
  )
  return created
}

async function main() {
  console.log('Seeding OPSBOARD...')

  const org = await findOrCreate('Organization',
    { slug: 'wuf13' },
    { id: randomUUID(), name: 'WUF13 Operations', slug: 'wuf13', isActive: true }
  )
  console.log(`+ Organization (${org.id.slice(0,8)})`)

  const proj = await findOrCreate('Project',
    { organizationId: org.id, slug: 'wuf13-main' },
    { id: randomUUID(), organizationId: org.id, name: 'WUF13',
      slug: 'wuf13-main', description: 'World Urban Forum 13', isActive: true }
  )
  console.log(`+ Project (${proj.id.slice(0,8)})`)

  const dept = await findOrCreate('Department',
    { projectId: proj.id, name: 'Guest Services' },
    { id: randomUUID(), projectId: proj.id, name: 'Guest Services', isActive: true }
  )
  console.log(`+ Department (${dept.id.slice(0,8)})`)

  const zoneNames = ['Main Entrance','Hall A','Hall B','Registration','VIP Lounge','Press Area']
  for (const name of zoneNames) {
    await findOrCreate('Zone',
      { projectId: proj.id, name },
      { id: randomUUID(), projectId: proj.id, name, isActive: true }
    )
  }
  console.log(`+ Zones (${zoneNames.length})`)

  const serviceNames = ['Info Desk','Accreditation','Transport','VIP Escort','General Flow']
  const services: any[] = []
  for (const name of serviceNames) {
    const svc = await findOrCreate('Service',
      { departmentId: dept.id, name },
      { id: randomUUID(), departmentId: dept.id, name, isActive: true }
    )
    services.push(svc)
  }
  console.log(`+ Services (${serviceNames.length})`)

  const userDefs = [
    { email: 'admin@opsboard.local',   name: 'Admin User',        role: 'ADMIN',          pw: 'admin123'   },
    { email: 'manager@opsboard.local', name: 'Senior Manager',    role: 'SENIOR_MANAGER', pw: 'manager123' },
    { email: 'coord@opsboard.local',   name: 'Field Coordinator', role: 'COORDINATOR',    pw: 'coord123'   },
  ]
  const users: Record<string, any> = {}
  for (const u of userDefs) {
    const [existing] = await q<any>('SELECT * FROM "User" WHERE email=$1', [u.email])
    if (existing) { users[u.email] = existing; continue }
    const hash = await bcrypt.hash(u.pw, 10)
    const [created] = await q<any>(
      `INSERT INTO "User"(id,"organizationId",email,"passwordHash","fullName",role,"isActive")
       VALUES($1,$2,$3,$4,$5,$6,true) RETURNING *`,
      [randomUUID(), org.id, u.email, hash, u.name, u.role]
    )
    users[u.email] = created
  }
  console.log('+ Users (3)')

  const coordId = users['coord@opsboard.local'].id
  for (const svc of services.slice(0, 2)) {
    await pool.query(
      'INSERT INTO "UserService"("userId","serviceId") VALUES($1,$2) ON CONFLICT DO NOTHING',
      [coordId, svc.id]
    )
  }
  console.log('+ Service assignments')

  await findOrCreate('Shift',
    { departmentId: dept.id, name: 'Morning Shift' },
    { id: randomUUID(), projectId: proj.id, departmentId: dept.id,
      name: 'Morning Shift', status: 'PLANNED', startsAt: new Date() }
  )
  console.log('+ Morning Shift (PLANNED)')

  console.log('\n SUCCESS')
  console.log('   admin@opsboard.local   / admin123')
  console.log('   manager@opsboard.local / manager123')
  console.log('   coord@opsboard.local   / coord123')
}

main().catch(console.error).finally(() => pool.end())
