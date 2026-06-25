type ErrorWithCode = Error & { code?: string };

type ParsedPostgresUrl = {
  user: string;
  password: string;
  hostname: string;
  port: string;
};

function getActiveDatabaseUrl(): string {
  return process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
}

/** Parse postgres URI; uses last @ so passwords may contain @ when URL-encoded. */
function parsePostgresConnectionString(connectionString: string): ParsedPostgresUrl | null {
  const trimmed = connectionString.trim().replace(/^["']|["']$/g, "");
  const schemeMatch = trimmed.match(/^postgres(ql)?:\/\//i);
  if (!schemeMatch) return null;

  const rest = trimmed.slice(schemeMatch[0].length);
  const atIndex = rest.lastIndexOf("@");
  if (atIndex <= 0) return null;

  const credentials = rest.slice(0, atIndex);
  const hostAndPath = rest.slice(atIndex + 1);
  const colonIndex = credentials.indexOf(":");
  if (colonIndex <= 0) return null;

  const hostMatch = hostAndPath.match(/^([^:/?#]+)(?::(\d+))?/);
  if (!hostMatch) return null;

  return {
    user: credentials.slice(0, colonIndex),
    password: credentials.slice(colonIndex + 1),
    hostname: hostMatch[1],
    port: hostMatch[2] ?? "5432",
  };
}

function isSupabaseDatabaseHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host.endsWith(".pooler.supabase.com") || /^db\.[a-z0-9]+\.supabase\.co$/i.test(host);
}

/** Safe host/port hint for error messages (no credentials). */
export function getDatabaseConnectionHint(): string | null {
  const parsed = parsePostgresConnectionString(getActiveDatabaseUrl());
  if (!parsed) return null;
  return `${parsed.hostname}:${parsed.port}`;
}

function getConnectionStringIssues(connectionString: string): string[] {
  const issues: string[] = [];

  if (!connectionString) return issues;

  if (/:6543[/?]/.test(connectionString)) {
    issues.push(
      "DIRECT_DATABASE_URL uses transaction pooler (port 6543). Use session pooler on port 5432 or direct db.[ref].supabase.co:5432."
    );
  }

  const parsed = parsePostgresConnectionString(connectionString);
  if (!parsed) {
    issues.push(
      "DATABASE_URL could not be parsed. Use session pooler: postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres — URL-encode @ # % in the password, or reset the DB password to letters and numbers only."
    );
    return issues;
  }

  if (/pooler\.supabase\.com/i.test(parsed.hostname) && parsed.port === "5432") {
    if (!/^postgres\.[a-z0-9]+$/i.test(parsed.user)) {
      issues.push(
        "Session pooler URL must use user postgres.[project-ref] (from Supabase Connect → Pooler), not postgres alone."
      );
    }
  }

  let decodedPassword = parsed.password;
  try {
    decodedPassword = decodeURIComponent(parsed.password);
  } catch {
    issues.push(
      "DATABASE_URL has invalid percent-encoding in the password. Use @ → %40, # → %23, or reset the Supabase database password to letters and numbers only."
    );
    return issues;
  }

  if (/[@#?&\s]/.test(decodedPassword) && parsed.password === decodedPassword) {
    issues.push(
      "Database password contains @ or # but is not URL-encoded in DATABASE_URL. Encode @ → %40, # → %23, or reset the Supabase password to letters and numbers only (recommended on Hostinger)."
    );
  }

  if (parsed.hostname.endsWith(".supabase.co") && !isSupabaseDatabaseHost(parsed.hostname)) {
    issues.push(
      `Host "${parsed.hostname}" is not a recognized Supabase database host. Use db.[ref].supabase.co or [region].pooler.supabase.com.`
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

  return issues;
}
