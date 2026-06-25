/**
 * Optional Supabase JS connectivity check (production / CI).
 * Usage: npm run check:supabase
 *
 * Values come from Supabase dashboard → Project Settings → API
 * (not from DATABASE_URL — the Postgres password is separate).
 */
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.log("Supabase JS: not configured (optional for storage/realtime).");
  console.log(
    "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env from Project Settings → API."
  );
  process.exit(0);
}

async function main() {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: anonKey },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error(`Supabase JS: unreachable (HTTP ${res.status})`);
    process.exit(1);
  }

  createClient(url, anonKey);

  console.log("Supabase JS: connected");
  console.log(`  URL: ${url}`);
  console.log(`  Client version: ${require("@supabase/supabase-js/package.json").version}`);
}

main().catch((error) => {
  console.error("Supabase JS:", error instanceof Error ? error.message : error);
  process.exit(1);
});
