type ErrorWithCode = Error & { code?: string };

export function formatAuthError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Internal server error";
  }

  const message = error.message;
  const code = (error as ErrorWithCode).code;

  if (message.includes("JWT_ACCESS_SECRET")) {
    return "Server setup incomplete: add JWT_ACCESS_SECRET in Hostinger environment variables.";
  }
  if (message.includes("JWT_REFRESH_SECRET")) {
    return "Server setup incomplete: add JWT_REFRESH_SECRET in Hostinger environment variables.";
  }
  if (message.includes("DATABASE_URL") || message.includes("DIRECT_DATABASE_URL")) {
    return "Server setup incomplete: add DATABASE_URL in Hostinger environment variables.";
  }
  if (message.includes("pooler") && message.includes("6543")) {
    return "Use Supabase direct connection (port 5432) for DIRECT_DATABASE_URL, not the pooler URL.";
  }

  if (code === "P1001" || message.includes("Can't reach database server")) {
    return "Cannot reach database. Use the Supabase direct URL (port 5432, host ends in .supabase.co), URL-encode special characters in the password, and in Supabase go to Project Settings → Database → Network → allow all IPs. Then redeploy Hostinger.";
  }
  if (code === "P1000" || message.includes("Authentication failed")) {
    return "Database authentication failed. Check the username and password in DATABASE_URL.";
  }
  if (code === "P2021" || code === "42P01" || message.includes("does not exist")) {
    return "Database tables are missing. Run npm run db:push and npm run db:seed from your computer.";
  }
  if (message.includes("SSL") || message.includes("ssl")) {
    return "Database SSL error. For Supabase, use the direct connection URL with port 5432.";
  }
  if (message.includes("ECONNREFUSED") || message.includes("ETIMEDOUT")) {
    return "Database connection refused or timed out. Verify DATABASE_URL and firewall settings.";
  }

  return "Internal server error";
}

export function getEnvSetupIssues(): string[] {
  const issues: string[] = [];

  if (!process.env.DATABASE_URL && !process.env.DIRECT_DATABASE_URL) {
    issues.push("DATABASE_URL is not set in Hostinger environment variables.");
  }
  if (!process.env.JWT_ACCESS_SECRET) {
    issues.push("JWT_ACCESS_SECRET is not set in Hostinger environment variables.");
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    issues.push("JWT_REFRESH_SECRET is not set in Hostinger environment variables.");
  }

  const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  if (connectionString && /:6543[/?]/.test(connectionString)) {
    issues.push(
      "DIRECT_DATABASE_URL uses a pooler (port 6543). Set it to the Supabase direct URL on port 5432."
    );
  }

  return issues;
}
