type ErrorWithCode = Error & { code?: string };

function getActiveDatabaseUrl(): string {
  return process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
}

/** Safe host/port hint for error messages (no credentials). */
export function getDatabaseConnectionHint(): string | null {
  const connectionString = getActiveDatabaseUrl();
  if (!connectionString) return null;

  try {
    const url = new URL(connectionString.replace(/^postgres(ql)?:\/\//, "http://"));
    const port = url.port || "5432";
    return `${url.hostname}:${port}`;
  } catch {
    return "invalid connection string";
  }
}

function getConnectionStringIssues(connectionString: string): string[] {
  const issues: string[] = [];

  if (!connectionString) return issues;

  if (/:6543[/?]/.test(connectionString)) {
    issues.push(
      "DIRECT_DATABASE_URL uses transaction pooler (port 6543). Use session pooler on port 5432 or direct db.[ref].supabase.co:5432."
    );
  }

  if (/pooler\.supabase\.com/i.test(connectionString) && /:5432[/?]/.test(connectionString)) {
    const userMatch = connectionString.match(/^postgres(ql)?:\/\/([^:]+):/i);
    const user = userMatch?.[2] ?? "";
    if (!/^postgres\.[a-z0-9]+$/i.test(user)) {
      issues.push(
        "Session pooler URL must use user postgres.[project-ref] (from Supabase Connect → Pooler), not postgres alone."
      );
    }
  }

  try {
    const url = new URL(connectionString.replace(/^postgres(ql)?:\/\//, "http://"));
    const rawPassword = connectionString.match(/^postgres(ql)?:\/\/[^:]+:([^@]+)@/i)?.[2];
    if (rawPassword && /[#?&\s]/.test(decodeURIComponent(rawPassword)) && rawPassword === decodeURIComponent(rawPassword)) {
      issues.push(
        "Database password contains special characters that must be URL-encoded in DATABASE_URL (e.g. @ → %40, # → %23, % → %25)."
      );
    }
    if (url.hostname.endsWith(".supabase.co") && !url.hostname.startsWith("db.")) {
      issues.push(
        `Host "${url.hostname}" does not look like a Supabase direct DB host. Expected db.[project-ref].supabase.co.`
      );
    }
  } catch {
    issues.push(
      "DATABASE_URL could not be parsed. Check the format: postgresql://postgres:[PASSWORD]@db.[ref].supabase.co:5432/postgres"
    );
  }

  return issues;
}

export function formatAuthError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Database connection failed (unknown error). Check DATABASE_URL in server environment variables.";
  }

  const message = error.message;
  const code = (error as ErrorWithCode).code;
  const name = error.name;

  if (message.includes("JWT_ACCESS_SECRET")) {
    return "Server setup incomplete: add JWT_ACCESS_SECRET in environment variables.";
  }
  if (message.includes("JWT_REFRESH_SECRET")) {
    return "Server setup incomplete: add JWT_REFRESH_SECRET in environment variables.";
  }
  if (message.includes("DATABASE_URL") || message.includes("DIRECT_DATABASE_URL")) {
    return "Server setup incomplete: add DATABASE_URL in environment variables.";
  }
  if (message.includes("pooler") && message.includes("6543")) {
    return "Use Supabase session pooler on port 5432, not transaction pooler on port 6543.";
  }
  if (/Tenant or user not found/i.test(message)) {
    return "Database user rejected by Supabase pooler. Use user postgres.[project-ref] (not postgres alone) in DATABASE_URL.";
  }
  if (message.includes("invalid percent encoding") || message.includes("URI malformed")) {
    return "DATABASE_URL is malformed. URL-encode special characters in the password (@ → %40, # → %23).";
  }

  if (
    code === "P1001" ||
    message.includes("Can't reach database server") ||
    message.includes("ENOTFOUND") ||
    message.includes("ENETUNREACH")
  ) {
    const hint = getDatabaseConnectionHint();
    const target = hint ? ` (currently configured: ${hint})` : "";
    return `Cannot reach database${target}. Use Supabase session pooler: Connect → Pooler → Session mode, port 5432, user postgres.[project-ref]. Allow all IPs under Database → Network, then redeploy.`;
  }
  if (
    code === "P1000" ||
    code === "28P01" ||
    message.includes("Authentication failed") ||
    message.includes("password authentication failed")
  ) {
    return "Database authentication failed. URL-encode special characters in the password (@ → %40, # → %23), then redeploy.";
  }
  if (code === "P2021" || code === "42P01" || message.includes("does not exist")) {
    return "Database tables are missing. Run npm run db:push and npm run db:seed from your computer.";
  }
  if (message.includes("SSL") || message.includes("ssl") || message.includes("TLS")) {
    return "Database SSL error. For Supabase pooler, keep port 5432 and use the session pooler URI from the dashboard.";
  }
  if (message.includes("ECONNREFUSED") || message.includes("ETIMEDOUT") || message.includes("connection timeout")) {
    return "Database connection refused or timed out. Verify DATABASE_URL and Supabase Network → allow all IPs.";
  }
  if (message.includes("prepared statement") && message.includes("already exists")) {
    return "Database pooler misconfiguration. Use session pooler on port 5432, not transaction pooler on port 6543.";
  }

  const hint = getDatabaseConnectionHint();
  const target = hint ? ` Host: ${hint}.` : "";
  const detail = [code, name !== "Error" ? name : null, message.slice(0, 100)]
    .filter(Boolean)
    .join(" — ");
  return `Database error.${target} ${detail}`;
}

export function getEnvSetupIssues(): string[] {
  const issues: string[] = [];

  if (!process.env.DATABASE_URL && !process.env.DIRECT_DATABASE_URL) {
    issues.push("DATABASE_URL is not set in environment variables.");
  }
  if (!process.env.JWT_ACCESS_SECRET) {
    issues.push("JWT_ACCESS_SECRET is not set in environment variables.");
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    issues.push("JWT_REFRESH_SECRET is not set in environment variables.");
  }

  const connectionString = getActiveDatabaseUrl();
  issues.push(...getConnectionStringIssues(connectionString));

  if (connectionString.includes("@") && /[#?]/.test(connectionString.split("@")[0] ?? "")) {
    issues.push(
      "DATABASE_URL password looks unencoded (@ or # before the host). URL-encode the password (@ → %40, # → %23)."
    );
  }

  return issues;
}
