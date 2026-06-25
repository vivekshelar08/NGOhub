import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signAccessToken, verifyRefreshToken } from "@/lib/auth-jwt";
import { REFRESH_COOKIE, createSession, setAccessCookie, setAuthCookies, toAuthUser } from "@/lib/auth";
import { ACCESS_COOKIE } from "@/lib/auth-constants";

export async function POST() {
  const cookieStore = await cookies();
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!refresh) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const payload = await verifyRefreshToken(refresh);
  if (!payload) {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: payload.jti },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date() || stored.user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const authUser = toAuthUser(stored.user);
  const { accessToken, refreshToken } = await createSession(authUser);

  const response = NextResponse.json({ user: authUser });
  setAuthCookies(response, accessToken, refreshToken);
  return response;
}

export async function GET() {
  const cookieStore = await cookies();
  const access = cookieStore.get(ACCESS_COOKIE)?.value;

  if (access) {
    const response = NextResponse.json({ ok: true });
    return response;
  }

  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refresh) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyRefreshToken(refresh);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: payload.jti },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date() || stored.user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authUser = toAuthUser(stored.user);
  const accessToken = await signAccessToken(authUser);

  const response = NextResponse.json({ user: authUser });
  setAccessCookie(response, accessToken);

  return response;
}
