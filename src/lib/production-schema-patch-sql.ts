/** Idempotent SQL — keep in sync with scripts/production-schema-patch.sql */
export const PRODUCTION_SCHEMA_PATCH_SQL = `
DO $$ BEGIN
  CREATE TYPE "BeneficiaryCohort" AS ENUM (
    'PWD', 'MIGRANT', 'SINGLE_MOTHER', 'SANITATION_WORKER', 'MINORITY',
    'SENIOR_CITIZEN', 'TRANSGENDER', 'WIDOW', 'ORPHAN', 'TRIBAL', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CorrectionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Beneficiary"
  ADD COLUMN IF NOT EXISTS "cohorts" "BeneficiaryCohort"[] NOT NULL DEFAULT ARRAY[]::"BeneficiaryCohort"[];

CREATE TABLE IF NOT EXISTS "AttendanceCorrectionRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "attendanceRecordId" TEXT,
  "date" DATE NOT NULL,
  "requestedPunchIn" TIMESTAMP(3),
  "requestedPunchOut" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "status" "CorrectionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceCorrectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProfileChangeRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "changes" JSONB NOT NULL,
  "reason" TEXT,
  "status" "CorrectionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AttendanceCorrectionRequest_userId_status_idx"
  ON "AttendanceCorrectionRequest"("userId", "status");
CREATE INDEX IF NOT EXISTS "AttendanceCorrectionRequest_status_idx"
  ON "AttendanceCorrectionRequest"("status");
CREATE INDEX IF NOT EXISTS "ProfileChangeRequest_userId_status_idx"
  ON "ProfileChangeRequest"("userId", "status");

DO $$ BEGIN
  ALTER TABLE "AttendanceCorrectionRequest"
    ADD CONSTRAINT "AttendanceCorrectionRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceCorrectionRequest"
    ADD CONSTRAINT "AttendanceCorrectionRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProfileChangeRequest"
    ADD CONSTRAINT "ProfileChangeRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProfileChangeRequest"
    ADD CONSTRAINT "ProfileChangeRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`;
