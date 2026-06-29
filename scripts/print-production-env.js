/**
 * Print production environment variables for Supabase + Node hosting.
 *
 * Usage:
 *   node scripts/print-production-env.js "<session-pooler-uri>" [app-url]
 *
 * Get the URI from Supabase → Connect → Pooler → Session mode (port 5432).
 * Example user: postgres.[project-ref]
 */
const crypto = require("crypto");

function usage() {
  console.error(
    'Usage: node scripts/print-production-env.js "<session-pooler-uri>" [app-url]'
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

function extractProjectRef(uri) {
  const userMatch = uri.match(/^postgres(ql)?:\/\/([^:]+):/i);
  const user = userMatch?.[2] ?? "";
  const refFromUser = user.match(/^postgres\.([a-z0-9]+)$/i)?.[1];
  if (refFromUser) return refFromUser;

  const hostMatch = uri.match(/@db\.([a-z0-9]+)\.supabase\.co/i);
  return hostMatch?.[1] ?? "[project-ref]";
}

const rawUri = process.argv[2];
const appUrl = process.argv[3] ?? "https://svihr.svitech.org";

if (!rawUri) usage();

const uri = encodePasswordInUri(rawUri.trim().replace(/^["']|["']$/g, ""));
const projectRef = extractProjectRef(uri);

const jwtAccess = crypto.randomBytes(32).toString("base64url");
const jwtRefresh = crypto.randomBytes(32).toString("base64url");

console.log("Paste into your hosting platform environment variables (no quotes):\n");
console.log(`DATABASE_URL=${uri}`);
console.log(`DIRECT_DATABASE_URL=${uri}`);
console.log(`JWT_ACCESS_SECRET=${jwtAccess}`);
console.log(`JWT_REFRESH_SECRET=${jwtRefresh}`);
console.log(`NEXT_PUBLIC_APP_URL=${appUrl}`);
console.log(`NEXT_PUBLIC_SUPABASE_URL=https://${projectRef}.supabase.co`);
console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase → Project Settings → API>");
console.log("\nSession pooler must use user postgres.[project-ref] on port 5432.");
console.log("Allow all IPs under Supabase → Database → Network before deploying.");
