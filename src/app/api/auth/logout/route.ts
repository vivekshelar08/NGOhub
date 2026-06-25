import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  clearAuthCookies,
  revokeRefreshToken,
} from "@/lib/auth";
import { REFRESH_COOKIE } from "@/lib/auth-constants";
import { verifyRefreshToken } from "@/lib/auth-jwt";

export async function POST() {
  const cookieStore = await cookies();
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;

  if (refresh) {
    const payload = await verifyRefreshToken(refresh);
    if (payload) {
      await revokeRefreshToken(payload.jti);
    }
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
