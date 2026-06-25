import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { DEMO_ACCOUNTS } from "../src/lib/demo-accounts";

const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_DATABASE_URL is not set");
}

function needsSsl(url: string) {
  if (/sslmode=(require|verify-full|prefer)/i.test(url)) return true;
  if (/@(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)) return false;
  return true;
}

const pool = new Pool({
  connectionString,
  ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const account of DEMO_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        passwordHash,
        name: account.name,
        role: account.role,
        department: account.department,
        status: "ACTIVE",
      },
      create: {
        email: account.email,
        passwordHash,
        name: account.name,
        role: account.role,
        department: account.department,
      },
    });
  }

  console.log(`Ensured ${DEMO_ACCOUNTS.length} demo accounts exist (all roles).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
