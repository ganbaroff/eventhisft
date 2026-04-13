-- OPSBOARD — Initial migration
-- Run: psql $DATABASE_URL -f migration.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN','ADMIN','SENIOR_MANAGER','SERVICE_MANAGER','COORDINATOR');
CREATE TYPE "ShiftStatus" AS ENUM ('PLANNED','ACTIVE','HANDOVER','CLOSED');
CREATE TYPE "OperationStatus" AS ENUM ('DRAFT','SUBMITTED','LOCKED');
CREATE TYPE "IncidentType" AS ENUM ('LOST_AND_FOUND','COMPLAINT','FLOW_DISRUPTION','OTHER');
CREATE TYPE "IncidentStatus" AS ENUM ('DRAFT','ACTIVE','ESCALATED','RESOLVED','ARCHIVED');
CREATE TYPE "AlertStatus" AS ENUM ('TRIGGERED','ACKNOWLEDGED','RESOLVED');
CREATE TYPE "SyncState" AS ENUM ('SYNCED','PENDING_CONFIRMATION','REJECTED');

CREATE TABLE "Organization" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Project" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMPTZ,
  "endsAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("organizationId", slug)
);

CREATE TABLE "Department" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id),
  name TEXT NOT NULL,
  description TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Zone" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "projectId" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON "Zone"("projectId");

CREATE TABLE "Service" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "departmentId" TEXT NOT NULL REFERENCES "Department"(id),
  name TEXT NOT NULL,
  description TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "User" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"(id),
  email TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  role "UserRole" NOT NULL DEFAULT 'COORDINATOR',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "UserService" (
  "userId" TEXT NOT NULL REFERENCES "User"(id),
  "serviceId" TEXT NOT NULL REFERENCES "Service"(id),
  "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY("userId","serviceId")
);

CREATE TABLE "Shift" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id),
  "departmentId" TEXT NOT NULL REFERENCES "Department"(id),
  name TEXT NOT NULL,
  status "ShiftStatus" NOT NULL DEFAULT 'PLANNED',
  "startsAt" TIMESTAMPTZ NOT NULL,
  "endsAt" TIMESTAMPTZ,
  "openedById" TEXT REFERENCES "User"(id),
  "closedById" TEXT REFERENCES "User"(id),
  "openedAt" TIMESTAMPTZ,
  "closedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Operation" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "shiftId" TEXT NOT NULL REFERENCES "Shift"(id),
  "serviceId" TEXT NOT NULL REFERENCES "Service"(id),
  "zoneId" TEXT REFERENCES "Zone"(id),
  "createdById" TEXT NOT NULL REFERENCES "User"(id),
  status "OperationStatus" NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  "syncState" "SyncState" NOT NULL DEFAULT 'SYNCED',
  "submittedAt" TIMESTAMPTZ,
  "lockedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Incident" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id),
  "zoneId" TEXT REFERENCES "Zone"(id),
  "serviceId" TEXT REFERENCES "Service"(id),
  "createdById" TEXT NOT NULL REFERENCES "User"(id),
  type "IncidentType" NOT NULL,
  status "IncidentStatus" NOT NULL DEFAULT 'ACTIVE',
  title TEXT NOT NULL,
  description TEXT,
  "syncState" "SyncState" NOT NULL DEFAULT 'SYNCED',
  "resolvedById" TEXT REFERENCES "User"(id),
  "resolvedAt" TIMESTAMPTZ,
  "archivedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "IncidentNote" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "incidentId" TEXT NOT NULL REFERENCES "Incident"(id),
  "authorId" TEXT NOT NULL REFERENCES "User"(id),
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Alert" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id),
  "incidentId" TEXT REFERENCES "Incident"(id),
  status "AlertStatus" NOT NULL DEFAULT 'TRIGGERED',
  message TEXT NOT NULL,
  "acknowledgedById" TEXT REFERENCES "User"(id),
  "acknowledgedAt" TIMESTAMPTZ,
  "resolvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "AuditEvent" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL REFERENCES "User"(id),
  action TEXT NOT NULL,
  payload JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON "AuditEvent"("entityType","entityId");
CREATE INDEX ON "AuditEvent"("actorId");
CREATE INDEX ON "AuditEvent"("createdAt");
