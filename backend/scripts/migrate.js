// OPSBOARD — Migration runner
// Uses pg directly — no psql binary required (Railway compatible).
//
// Applies every migration folder under prisma/migrations/*/migration.sql
// in lexical order. Tracks applied migrations in schema_migrations so a
// redeploy doesn't re-run them. Idempotent via table check, NOT via
// "already exists" substring matching (that was a P0 audit finding —
// a substring match would swallow real failures mid-migration).

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const MIGRATIONS_DIR = path.join(__dirname, '../prisma/migrations')

async function ensureTracker() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

async function getApplied() {
  const r = await pool.query('SELECT name FROM schema_migrations')
  return new Set(r.rows.map(x => x.name))
}

function listPending(applied) {
  if (!fs.existsSync(MIGRATIONS_DIR)) return []
  const entries = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort() // lexical: 001_init, 002_token_version, 003_must_change_password, ...
  const pending = []
  for (const name of entries) {
    const sqlFile = path.join(MIGRATIONS_DIR, name, 'migration.sql')
    if (!fs.existsSync(sqlFile)) continue
    if (applied.has(name)) continue
    pending.push({ name, sqlFile })
  }
  return pending
}

async function apply(name, sqlFile) {
  const sql = fs.readFileSync(sqlFile, 'utf8')
  console.log(`→ Applying ${name} (${sql.length} bytes)…`)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query(
      'INSERT INTO schema_migrations(name) VALUES($1) ON CONFLICT DO NOTHING',
      [name],
    )
    await client.query('COMMIT')
    console.log(`✅ ${name} applied`)
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    console.error(`❌ ${name} FAILED`)
    console.error('  code    :', e.code)
    console.error('  msg     :', e.message)
    console.error('  detail  :', e.detail)
    console.error('  where   :', e.where)
    console.error('  position:', e.position)
    console.error('  stack   :', e.stack)
    throw e
  } finally {
    client.release()
  }
}

async function migrate() {
  await ensureTracker()
  const applied = await getApplied()
  const pending = listPending(applied)

  if (pending.length === 0) {
    console.log('✅ No pending migrations')
    return
  }

  // Backfill guard: if the public schema is non-empty but schema_migrations
  // is empty, someone (hi Atlas) applied migrations by hand. Record them as
  // already applied so we don't double-apply on the next deploy.
  if (applied.size === 0) {
    const schemaCheck = await pool.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'User' LIMIT 1
    `)
    if (schemaCheck.rowCount > 0) {
      console.log('⚠ Tracker empty but schema exists — assuming prior manual apply')
      console.log('  marking all known migrations as applied to avoid re-run:')
      for (const p of pending) {
        await pool.query(
          'INSERT INTO schema_migrations(name) VALUES($1) ON CONFLICT DO NOTHING',
          [p.name],
        )
        console.log(`  • recorded ${p.name} as applied`)
      }
      console.log('✅ Backfill complete — no DDL executed')
      return
    }
  }

  console.log(`${pending.length} pending migration(s): ${pending.map(p => p.name).join(', ')}`)
  for (const { name, sqlFile } of pending) {
    await apply(name, sqlFile)
  }
}

migrate()
  .catch(e => { console.error('Migration runner exited with error:', e.message); process.exit(1) })
  .finally(() => pool.end())
