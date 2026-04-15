// OPSBOARD — Production seed script
// Called by deploy.sh — idempotent, safe to run multiple times

const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
const { randomUUID } = require('crypto')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // Check if already seeded
  const { rows } = await pool.query(
    'SELECT id FROM "Organization" WHERE slug=$1 LIMIT 1',
    ['wuf13']
  )
  if (rows.length > 0) {
    console.log('✅ Already seeded — skipping')
    return
  }

  const orgId = randomUUID(), projId = randomUUID(), deptId = randomUUID()
  const adminId = randomUUID(), mgrId = randomUUID(), coordId = randomUUID()
  const shiftId = randomUUID()

  await pool.query(
    'INSERT INTO "Organization"(id,name,slug) VALUES($1,$2,$3)',
    [orgId, 'WUF13 Operations', 'wuf13']
  )
  await pool.query(
    'INSERT INTO "Project"(id,"organizationId",name,slug,description,"isActive") VALUES($1,$2,$3,$4,$5,true)',
    [projId, orgId, 'WUF13', 'wuf13-main', 'World Urban Forum 13']
  )
  await pool.query(
    'INSERT INTO "Department"(id,"projectId",name,"isActive") VALUES($1,$2,$3,true)',
    [deptId, projId, 'Guest Services']
  )

  for (const name of ['Main Entrance','Hall A','Hall B','Registration','VIP Lounge','Press Area']) {
    await pool.query(
      'INSERT INTO "Zone"(id,"projectId",name,"isActive") VALUES($1,$2,$3,true)',
      [randomUUID(), projId, name]
    )
  }

  const svcIds = []
  for (const name of ['Info Desk','Accreditation','Transport','VIP Escort','General Flow']) {
    const id = randomUUID()
    svcIds.push(id)
    await pool.query(
      'INSERT INTO "Service"(id,"departmentId",name,"isActive") VALUES($1,$2,$3,true)',
      [id, deptId, name]
    )
  }

  // In production, generate fresh random passwords and log them ONCE.
  // In dev, allow hardcoded convenience creds only when explicitly opted in.
  const isProd = process.env.NODE_ENV === 'production'
  const allowDevDefaults = process.env.ALLOW_DEV_DEFAULT_PASSWORDS === '1'
  const genPwd = () =>
    require('crypto').randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12)
  const makePwd = (hardcoded) => (isProd ? genPwd() : (allowDevDefaults ? hardcoded : genPwd()))

  const accounts = [
    [adminId, 'admin@opsboard.local',   'Admin User',        'ADMIN',          makePwd('admin123')],
    [mgrId,   'manager@opsboard.local', 'Senior Manager',    'SENIOR_MANAGER', makePwd('manager123')],
    [coordId, 'coord@opsboard.local',   'Field Coordinator', 'COORDINATOR',    makePwd('coord123')],
  ]
  for (const [uid, email, fullName, role, pwd] of accounts) {
    const passwordHash = bcrypt.hashSync(pwd, 10)
    // mustChangePassword=true: seeded creds are logged once to the deploy
    // log (see SEEDED_CRED line below). Forcing rotation on first login
    // closes that exposure window automatically.
    await pool.query(
      'INSERT INTO "User"(id,"organizationId",email,"passwordHash","fullName",role,"isActive","mustChangePassword") VALUES($1,$2,$3,$4,$5,$6,true,true)',
      [uid, orgId, email, passwordHash, fullName, role]
    )
    console.log(`   SEEDED_CRED ${email} / ${pwd}  (must change on first login)`)
  }

  // Assign coordinator to first 2 services
  for (const sid of svcIds.slice(0, 2)) {
    await pool.query(
      'INSERT INTO "UserService"("userId","serviceId") VALUES($1,$2)',
      [coordId, sid]
    )
  }

  await pool.query(
    'INSERT INTO "Shift"(id,"projectId","departmentId",name,status,"startsAt") VALUES($1,$2,$3,$4,$5::\"ShiftStatus\",NOW())',
    [shiftId, projId, deptId, 'Morning Shift', 'PLANNED']
  )

  console.log('✅ Seeded successfully')
  console.log('   admin@opsboard.local   / admin123')
  console.log('   manager@opsboard.local / manager123')
  console.log('   coord@opsboard.local   / coord123')
}

main()
  .catch(e => {
    console.error('❌ Seed FAILED')
    console.error('  code:', e.code)
    console.error('  msg :', e.message)
    console.error('  detail:', e.detail)
    console.error('  stack:', e.stack)
    process.exit(1)
  })
  .finally(() => pool.end())
