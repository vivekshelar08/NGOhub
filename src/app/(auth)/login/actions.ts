"use server";

import { authenticateWithPassword, setAuthCookiesInStore } from "@/lib/auth";
import type { AuthUser } from "@/types/auth";

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
    return { error: "Internal server error" };
  }
}
