#!/bin/bash
# OPSBOARD — Railway deploy script
# Idempotent — safe to run multiple times

set -e

echo "╔═══════════════════════════╗"
echo "║  OPSBOARD — Deploy Start  ║"
echo "╚═══════════════════════════╝"
echo "Node: $(node --version)"
echo "Env:  ${NODE_ENV:-development}"
echo ""

echo "1/3 Database migration..."
node scripts/migrate.js

echo ""
echo "2/3 Seeding default data..."
node scripts/seed.js

echo ""
echo "3/3 Starting NestJS server..."
exec node dist/src/main.js
