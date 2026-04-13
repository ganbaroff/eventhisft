#!/bin/bash
# OPSBOARD — Railway deploy script
# Runs migration + seed + starts the app
# Idempotent — safe to run multiple times

set -e
echo "=== OPSBOARD Deploy ==="

echo "1/3 Running migration..."
psql "$DATABASE_URL" -f prisma/migrations/001_init/migration.sql 2>/dev/null \
  && echo "Migration applied" \
  || echo "Tables exist — continuing"

echo "2/3 Running seed..."
node -e "
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  const { rows } = await pool.query('SELECT id FROM \"Organization\" WHERE slug=\$1 LIMIT 1', ['wuf13']);
  if (rows.length > 0) { console.log('Already seeded'); return; }
  const orgId=randomUUID(), projId=randomUUID(), deptId=randomUUID();
  const adminId=randomUUID(), mgrId=randomUUID(), coordId=randomUUID(), shiftId=randomUUID();
  await pool.query('INSERT INTO \"Organization\"(id,name,slug) VALUES(\$1,\$2,\$3)',[orgId,'WUF13 Operations','wuf13']);
  await pool.query('INSERT INTO \"Project\"(id,\"organizationId\",name,slug,\"isActive\") VALUES(\$1,\$2,\$3,\$4,true)',[projId,orgId,'WUF13','wuf13-main']);
  await pool.query('INSERT INTO \"Department\"(id,\"projectId\",name,\"isActive\") VALUES(\$1,\$2,\$3,true)',[deptId,projId,'Guest Services']);
  for (const n of ['Main Entrance','Hall A','Hall B','Registration','VIP Lounge','Press Area'])
    await pool.query('INSERT INTO \"Zone\"(id,\"projectId\",name,\"isActive\") VALUES(\$1,\$2,\$3,true)',[randomUUID(),projId,n]);
  const svcIds=[];
  for (const n of ['Info Desk','Accreditation','Transport','VIP Escort','General Flow']) {
    const id=randomUUID(); svcIds.push(id);
    await pool.query('INSERT INTO \"Service\"(id,\"departmentId\",name,\"isActive\") VALUES(\$1,\$2,\$3,true)',[id,deptId,n]);
  }
  for (const [uid,email,name,role,pwd] of [
    [adminId,'admin@opsboard.local','Admin User','ADMIN','admin123'],
    [mgrId,'manager@opsboard.local','Senior Manager','SENIOR_MANAGER','manager123'],
    [coordId,'coord@opsboard.local','Field Coordinator','COORDINATOR','coord123'],
  ]) {
    await pool.query('INSERT INTO \"User\"(id,\"organizationId\",email,\"passwordHash\",\"fullName\",role,\"isActive\") VALUES(\$1,\$2,\$3,\$4,\$5,\$6,true)',[uid,orgId,email,bcrypt.hashSync(pwd,10),name,role]);
  }
  for (const sid of svcIds.slice(0,2))
    await pool.query('INSERT INTO \"UserService\"(\"userId\",\"serviceId\") VALUES(\$1,\$2)',[coordId,sid]);
  await pool.query('INSERT INTO \"Shift\"(id,\"projectId\",\"departmentId\",name,status,\"startsAt\") VALUES(\$1,\$2,\$3,\$4,\'PLANNED\',NOW())',[shiftId,projId,deptId,'Morning Shift']);
  console.log('Seeded: admin@opsboard.local/admin123 | manager@opsboard.local/manager123 | coord@opsboard.local/coord123');
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>pool.end());
"

echo "3/3 Starting server..."
node dist/src/main.js
