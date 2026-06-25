import "dotenv/config";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function getConnectionString() {
  return process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
}

function isPoolerConnectionString(connectionString: string) {
  return /:6543[/?]/.test(connectionString) || /pooler\.supabase\.com/i.test(connectionString);
}

function needsSsl(connectionString: string) {
  if (/sslmode=(require|verify-full|prefer)/i.test(connectionString)) return true;
  return /supabase\.com|neon\.tech|render\.com|railway\.app|hostingersite\.com/i.test(connectionString);
}

function getPool() {
  if (!globalForPrisma.pool) {
    const connectionString = getConnectionString();
    if (!connectionString) {
      throw new Error("DATABASE_URL or DIRECT_DATABASE_URL is not set");
    }

    if (isPoolerConnectionString(connectionString)) {
      console.warn(
        "Prisma is using a pooler URL. For Hostinger/Supabase, set DIRECT_DATABASE_URL to the direct connection on port 5432."
      );
    }

    globalForPrisma.pool = new Pool({
      connectionString,
      ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
      max: 5,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForPrisma.pool;
}

function createPrismaClient() {
  const adapter = new PrismaPg(getPool());
  return new PrismaClient({ adapter });
}

/** Models that must exist on the cached Prisma client (bump when adding schema models). */
const REQUIRED_PRISMA_DELEGATES = [
  "expense",
  "survey",
  "teamMessage",
  "inAppNotification",
] as const;

function isStalePrismaClient(client: PrismaClient): boolean {
  const missingDelegates = REQUIRED_PRISMA_DELEGATES.some((delegate) => !(delegate in client));
  const missingBeneficiaryFields =
    !("isRemoved" in Prisma.BeneficiaryScalarFieldEnum) || !("removedAt" in Prisma.BeneficiaryScalarFieldEnum);

  return missingDelegates || missingBeneficiaryFields;
}

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && process.env.NODE_ENV !== "production" && isStalePrismaClient(cached)) {
    globalForPrisma.prisma = undefined;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();

globalForPrisma.prisma = prisma;
