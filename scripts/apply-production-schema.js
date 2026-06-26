/**
 * Apply production-schema-patch.sql to Supabase/Postgres.
 *
 * Usage:
 *   node scripts/apply-production-schema.js "<session-pooler-uri>"
 *
 * Get URI from Hostinger hPanel → Environment variables → DATABASE_URL
 * (session pooler, port 5432, user postgres.[project-ref])
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function encodePasswordInUri(uri) {
  const match = uri.match(/^(postgres(ql)?:\/\/)([^:]+):([^@]+)@(.+)$/i);
  if (!match) return uri;
  const [, scheme, , user, password, rest] = match;
  let decoded = password;
  try {
    decoded = decodeURIComponent(password);
  } catch {
    return uri;
  }
  const encoded = encodeURIComponent(decoded);
  if (password === encoded) return uri;
  return `${scheme}${user}:${encoded}@${rest}`;
}

async function main() {
  const raw =
    process.argv[2] ?? process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!raw) {
    console.error(
      'Usage: node scripts/apply-production-schema.js "<DATABASE_URL>"'
    );
    process.exit(1);
  }

  const uri = encodePasswordInUri(raw.trim().replace(/^["']|["']$/g, ""));
  const sqlPath = path.join(__dirname, "production-schema-patch.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  const pool = new Pool({
    connectionString: uri,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000,
  });

  try {
    console.log("Connecting to database...");
    await pool.query("SELECT 1");
    console.log("Applying schema patch...");
    await pool.query(sql);
    const check = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'Beneficiary' AND column_name = 'cohorts'`
    );
    if (check.rows.length === 0) {
      throw new Error("cohorts column still missing after patch");
    }
    console.log("Schema patch applied successfully. Beneficiary.cohorts exists.");
  } catch (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
