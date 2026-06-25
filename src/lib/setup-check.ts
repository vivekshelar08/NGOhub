import { prisma } from "./prisma";
import { formatAuthError, getEnvSetupIssues } from "./auth-errors";

export type SetupCheckResult = {
  ok: boolean;
  issues: string[];
};

export async function runSetupCheck(): Promise<SetupCheckResult> {
  const issues = getEnvSetupIssues();
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    const userCount = await prisma.user.count();
    if (userCount === 0) {
      issues.push(
        "Database is connected but has no users. Run npm run db:push and npm run db:seed from your computer."
      );
    }
  } catch (error) {
    issues.push(formatAuthError(error));
  }

  return { ok: issues.length === 0, issues };
}
