/**
 * Test Postgres connectivity using DATABASE_URL / DIRECT_DATABASE_URL from .env.
 * Run locally before deploying: node scripts/check-database.js
 */
require("dotenv/config");
const { Pool } = require("pg");

const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error("FAIL: Set DATABASE_URL or DIRECT_DATABASE_URL in .env");
  process.exit(1);
}

if (/pooler\.supabase\.com/i.test(connectionString) && /:6543[/?]/.test(connectionString)) {
  console.error("FAIL: Use session pooler on port 5432, not transaction pooler 6543.");
  process.exit(1);
}

function needsSsl(cs) {
  if (/sslmode=(require|verify-full|prefer)/i.test(cs)) return true;
  return !/@(localhost|127\.0\.0\.1)(:\d+)?/i.test(cs);
}

async function main() {
  let host = "unknown";
  try {
    const url = new URL(connectionString.replace(/^postgres(ql)?:\/\//, "http://"));
    host = `${url.hostname}:${url.port || "5432"}`;
  } catch {
    console.error("FAIL: Could not parse connection string");
    process.exit(1);
  }

  console.log(`Connecting to ${host} ...`);

  const pool = new Pool({
    connectionString,
    ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15_000,
  });

  try {
    const result = await pool.query("SELECT 1 AS ok");
    console.log("OK: Database reachable", result.rows[0]);
  } catch (error) {
    console.error("FAIL:", error.message);
    if (error.code === "P1001" || /Can't reach database server/i.test(error.message)) {
      console.error(
        "\nTips:\n" +
          "- Supabase → Connect → Pooler → Session mode (port 5432)\n" +
          "- Or direct: db.[ref].supabase.co (if your network supports IPv6)\n" +
          "- URL-encode special characters in the password\n" +
          "- Database → Network → allow all IPs (0.0.0.0/0)\n" +
          "- Ensure the Supabase project is not paused"
      );
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
