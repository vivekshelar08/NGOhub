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

function isTransactionPooler(connectionString: string) {
  return /:6543[/?]/.test(connectionString);
}

function isPoolerConnectionString(connectionString: string) {
  return isTransactionPooler(connectionString) || /pooler\.supabase\.com/i.test(connectionString);
}

function isLocalDatabase(connectionString: string) {
  try {
    const url = new URL(connectionString.replace(/^postgres(ql)?:\/\//, "http://"));
    const host = url.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /@(localhost|127\.0\.0\.1)(:\d+)?/i.test(connectionString);
  }
}

function needsSsl(connectionString: string) {
  if (/sslmode=(require|verify-full|prefer)/i.test(connectionString)) return true;
  if (isLocalDatabase(connectionString)) return false;
  return true;
}

function getPoolMax(connectionString: string) {
  const fromEnv = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  if (isTransactionPooler(connectionString)) return 1;
  if (isPoolerConnectionString(connectionString)) return 8;
  return 10;
}

function getPool() {
  if (!globalForPrisma.pool) {
    const connectionString = getConnectionString();
    if (!connectionString) {
      throw new Error("DATABASE_URL or DIRECT_DATABASE_URL is not set");
    }

    if (isTransactionPooler(connectionString)) {
      console.warn(
        "Prisma is using transaction pooler (port 6543). Use session pooler on port 5432 or direct connection instead."
      );
    } else if (/pooler\.supabase\.com/i.test(connectionString)) {
      console.warn(
        "Prisma is using Supavisor session pooler (IPv4). Use this when direct db.*.supabase.co is unreachable from your host."
      );
    }

    globalForPrisma.pool = new Pool({
      connectionString,
      ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
      max: getPoolMax(connectionString),
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 8_000,
      allowExitOnIdle: false,
    });

    globalForPrisma.pool.on("error", (error) => {
      console.error("Postgres pool error:", error.message);
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

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
