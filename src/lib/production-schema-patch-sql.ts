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

-- Community contribution (rates by project / location / service + collection entries)

DO $$ BEGIN
  CREATE TYPE "CommunityContributionCollectionStatus" AS ENUM ('COLLECTED', 'PENDING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommunityContributionRecipientType" AS ENUM ('NGO', 'PARTNER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CommunityContributionRule" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "location" TEXT NOT NULL DEFAULT '',
  "amountPerBeneficiary" DECIMAL(12,2) NOT NULL,
  "recipientType" "CommunityContributionRecipientType" NOT NULL DEFAULT 'NGO',
  "partnerId" TEXT,
  "partnerName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityContributionRule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CommunityContributionRule"
  ADD COLUMN IF NOT EXISTS "location" TEXT NOT NULL DEFAULT '';

DO $$ BEGIN
  ALTER TABLE "CommunityContributionRule"
    DROP CONSTRAINT "CommunityContributionRule_projectId_serviceId_key";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityContributionRule"
    ADD CONSTRAINT "CommunityContributionRule_projectId_serviceId_location_key"
    UNIQUE ("projectId", "serviceId", "location");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "CommunityContributionRule_projectId_idx"
  ON "CommunityContributionRule"("projectId");
CREATE INDEX IF NOT EXISTS "CommunityContributionRule_projectId_location_idx"
  ON "CommunityContributionRule"("projectId", "location");

DO $$ BEGIN
  ALTER TABLE "CommunityContributionRule"
    ADD CONSTRAINT "CommunityContributionRule_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityContributionRule"
    ADD CONSTRAINT "CommunityContributionRule_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "PartnerOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CommunityContributionEntry" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "beneficiaryId" TEXT NOT NULL,
  "serviceDeliveryId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "collectionStatus" "CommunityContributionCollectionStatus" NOT NULL DEFAULT 'PENDING',
  "recipientType" "CommunityContributionRecipientType" NOT NULL,
  "partnerId" TEXT,
  "partnerName" TEXT,
  "collectedAt" TIMESTAMP(3),
  "enteredById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityContributionEntry_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CommunityContributionEntry"
    ADD CONSTRAINT "CommunityContributionEntry_serviceDeliveryId_key" UNIQUE ("serviceDeliveryId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "CommunityContributionEntry_projectId_createdAt_idx"
  ON "CommunityContributionEntry"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "CommunityContributionEntry_enteredById_createdAt_idx"
  ON "CommunityContributionEntry"("enteredById", "createdAt");
CREATE INDEX IF NOT EXISTS "CommunityContributionEntry_collectionStatus_idx"
  ON "CommunityContributionEntry"("collectionStatus");

DO $$ BEGIN
  ALTER TABLE "CommunityContributionEntry"
    ADD CONSTRAINT "CommunityContributionEntry_beneficiaryId_fkey"
    FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityContributionEntry"
    ADD CONSTRAINT "CommunityContributionEntry_serviceDeliveryId_fkey"
    FOREIGN KEY ("serviceDeliveryId") REFERENCES "ServiceDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityContributionEntry"
    ADD CONSTRAINT "CommunityContributionEntry_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityContributionEntry"
    ADD CONSTRAINT "CommunityContributionEntry_enteredById_fkey"
    FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`;
