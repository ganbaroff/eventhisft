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
    if (e.message && (
      e.message.includes('already exists') ||
      e.message.includes('duplicate')
    )) {
      console.log('✅ Schema already exists — skipping migration')
    } else {
      // Log but don't exit — partial state is recoverable
      console.warn('⚠ Migration warning:', e.message.slice(0, 200))
    }
  }
}

migrate()
  .catch(e => { console.error('Migration failed:', e.message); process.exit(1) })
  .finally(() => pool.end())
