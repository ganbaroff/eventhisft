// OPSBOARD — Migration runner
// Uses pg directly — no psql binary required (Railway compatible)

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function migrate() {
  const sqlPath = path.join(__dirname, '../prisma/migrations/001_init/migration.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  try {
    await pool.query(sql)
    console.log('✅ Migration applied')
  } catch (e) {
    const msg = e.message || ''
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log('✅ Schema already exists — skipping migration')
      return
    }
    console.error('❌ Migration FAILED')
    console.error('  code:', e.code)
    console.error('  msg :', msg)
    console.error('  detail:', e.detail)
    console.error('  where :', e.where)
    console.error('  position:', e.position)
    console.error('  stack:', e.stack)
    throw e
  }
}

migrate()
  .catch(e => { console.error('Migration runner exited with error'); process.exit(1) })
  .finally(() => pool.end())
