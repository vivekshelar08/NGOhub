/**
 * One-shot production DB setup: validate Supabase URL, push schema, seed users.
 *
 * Usage (session pooler — IPv4, recommended for most Node hosts):
 *   node scripts/setup-production-db.js "postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"
 *
 * Or direct (IPv6 only unless IPv4 add-on):
 *   node scripts/setup-production-db.js "postgresql://postgres:[PASSWORD]@db.[ref].supabase.co:5432/postgres"
 */
require("dotenv/config");
const crypto = require("crypto");
const { execSync } = require("child_process");
const { Pool } = require("pg");

function usage() {
  console.error(
    "Usage: node scripts/setup-production-db.js \"postgresql://postgres.[ref]:[PASSWORD]@aws-1-[region].pooler.supabase.com:5432/postgres\""
  );
  process.exit(1);
}

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

function validateUri(uri) {
  const issues = [];
  if (/:6543[/?]/.test(uri)) {
    issues.push("Uses port 6543 (transaction pooler) — use session pooler on port 5432");
  }
  let host = "";
  try {
    const url = new URL(uri.replace(/^postgres(ql)?:\/\//, "http://"));
    host = `${url.hostname}:${url.port || "5432"}`;
    if (/pooler\.supabase\.com/i.test(uri) && !/postgres\.[^:@]+/i.test(uri)) {
      issues.push("Session pooler requires user postgres.[project-ref]");
    }
  } catch {
    issues.push("Could not parse connection URI");
  }
  return { issues, host };
}

async function testConnection(uri) {
  const pool = new Pool({
    connectionString: uri,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 25_000,
  });
  try {
    await pool.query("SELECT 1");
  } finally {
    await pool.end();
  }
}

function extractProjectRef(uri) {
  const userMatch = uri.match(/^postgres(ql)?:\/\/([^:]+):/i);
  const user = userMatch?.[2] ?? "";
  const refFromUser = user.match(/^postgres\.([a-z0-9]+)$/i)?.[1];
  if (refFromUser) return refFromUser;
  const hostMatch = uri.match(/@db\.([a-z0-9]+)\.supabase\.co/i);
  return hostMatch?.[1] ?? null;
}

async function main() {
  const raw = process.argv[2] ?? process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!raw) usage();

  const uri = encodePasswordInUri(raw.trim().replace(/^["']|["']$/g, ""));
  const { issues, host } = validateUri(uri);
  if (issues.length > 0) {
    console.error("Invalid connection URI:");
    issues.forEach((issue) => console.error(`  - ${issue}`));
    process.exit(1);
  }

  console.log(`Testing connection to ${host} ...`);
  try {
    await testConnection(uri);
    console.log("Connection OK\n");
  } catch (error) {
    console.error("Connection failed:", error.message);
    if (/ENOTFOUND|ENETUNREACH/i.test(error.message) && /db\./i.test(uri)) {
      console.error(
        "\nDirect db.* host is IPv6-only. Use Supabase → Connect → Pooler → Session mode (port 5432)."
      );
    }
    if (/password authentication failed/i.test(error.message)) {
      console.error("\nReset password: Supabase → Project Settings → Database → Reset database password.");
    }
    console.error("\nAlso: Database → Network → allow all IPs (0.0.0.0/0).");
    process.exit(1);
  }

  const env = {
    ...process.env,
    DATABASE_URL: uri,
    DIRECT_DATABASE_URL: uri,
  };

  console.log("Pushing schema (prisma db push) ...");
  execSync("npx prisma db push", { stdio: "inherit", env });

  console.log("\nSeeding demo users ...");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });

  const projectRef = extractProjectRef(uri);
  const jwtAccess = crypto.randomBytes(32).toString("base64url");
  const jwtRefresh = crypto.randomBytes(32).toString("base64url");

  console.log("\n--- Production environment variables (copy to your host) ---\n");
  console.log(`DATABASE_URL=${uri}`);
  console.log(`DIRECT_DATABASE_URL=${uri}`);
  console.log(`JWT_ACCESS_SECRET=${jwtAccess}`);
  console.log(`JWT_REFRESH_SECRET=${jwtRefresh}`);
  console.log("NEXT_PUBLIC_APP_URL=https://svihr.svitech.org");
  if (projectRef) {
    console.log(`NEXT_PUBLIC_SUPABASE_URL=https://${projectRef}.supabase.co`);
  }
  console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase → Project Settings → API>");
  console.log("\n--- Done. Set these on your host and redeploy. ---");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
