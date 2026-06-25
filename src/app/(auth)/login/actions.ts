"use server";

import { authenticateWithPassword, setAuthCookiesInStore } from "@/lib/auth";
import { formatAuthError } from "@/lib/auth-errors";
import { runSetupCheck, type SetupCheckResult } from "@/lib/setup-check";
import type { AuthUser } from "@/types/auth";

export async function checkSetupAction(): Promise<SetupCheckResult> {
  return runSetupCheck();
}

export async function loginAction(
  email: string,
  password: string
): Promise<{ user: AuthUser } | { error: string }> {
  try {
    const result = await authenticateWithPassword(email, password);
    if (!result.ok) {
      return { error: result.error };
    }

    await setAuthCookiesInStore(result.accessToken, result.refreshToken);
    return { user: result.user };
  } catch (error) {
    console.error("Login error:", error);
    return { error: formatAuthError(error) };
  }
}
