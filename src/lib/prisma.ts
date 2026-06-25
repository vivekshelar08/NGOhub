import "dotenv/config";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  pool: Pool;
};

function getConnectionString() {
  return process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
}

function needsSsl(connectionString: string) {
  if (/sslmode=(require|verify-full|prefer)/i.test(connectionString)) return true;
  return /supabase\.com|neon\.tech|render\.com|railway\.app/i.test(connectionString);
}

function getPool() {
  if (!globalForPrisma.pool) {
    const connectionString = getConnectionString();
    if (!connectionString) {
      throw new Error("DATABASE_URL or DIRECT_DATABASE_URL is not set");
    }

    globalForPrisma.pool = new Pool({
      connectionString,
      ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
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
    // When schema changes (new fields) but dev server keeps an old client instance,
    // Prisma will throw "Unknown argument" at runtime. This guard forces a refresh.
    // (Works because scalar enums are generated alongside the client.)
    !("isRemoved" in Prisma.BeneficiaryScalarFieldEnum) || !("removedAt" in Prisma.BeneficiaryScalarFieldEnum);

  return missingDelegates || missingBeneficiaryFields;
}

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && process.env.NODE_ENV !== "production" && isStalePrismaClient(cached)) {
    globalForPrisma.prisma = undefined as unknown as PrismaClient;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
