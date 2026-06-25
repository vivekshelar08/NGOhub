import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "./prisma";
import type { AuthUser } from "@/types/auth";
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_TTL_MS } from "./auth-constants";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "./auth-jwt";
import { loginSchema } from "./validators";

export { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth-constants";

function shouldUseSecureCookies() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";
}

function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string) {
  response.cookies.set(ACCESS_COOKIE, accessToken, authCookieOptions(15 * 60));
  response.cookies.set(REFRESH_COOKIE, refreshToken, authCookieOptions(7 * 24 * 60 * 60));
}

export async function setAuthCookiesInStore(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, accessToken, authCookieOptions(15 * 60));
  cookieStore.set(REFRESH_COOKIE, refreshToken, authCookieOptions(7 * 24 * 60 * 60));
}

export function setAccessCookie(response: NextResponse, accessToken: string) {
  response.cookies.set(ACCESS_COOKIE, accessToken, authCookieOptions(15 * 60));
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export type LoginResult =
  | { ok: true; user: AuthUser; accessToken: string; refreshToken: string }
  | { ok: false; error: string; status: number };

export async function authenticateWithPassword(email: string, password: string): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input", status: 400 };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || user.status !== "ACTIVE") {
    return { ok: false, error: "Invalid email or password", status: 401 };
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "Invalid email or password", status: 401 };
  }

  const authUser = toAuthUser(user);
  const { accessToken, refreshToken } = await createSession(authUser);
  return { ok: true, user: authUser, accessToken, refreshToken };
}

export async function createSession(user: AuthUser) {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await prisma.refreshToken.create({
    data: {
      token: jti,
      userId: user.id,
      expiresAt,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = await signAccessToken(user);
  const refreshToken = await signRefreshToken(user.id, jti);

  return { accessToken, refreshToken };
}

export async function revokeRefreshToken(jti: string) {
  await prisma.refreshToken.deleteMany({ where: { token: jti } });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const access = cookieStore.get(ACCESS_COOKIE)?.value;

  if (access) {
    const payload = await verifyAccessToken(access);
    if (payload) {
      return {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };
    }
  }

  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;

  const refreshPayload = await verifyRefreshToken(refresh);
  if (!refreshPayload) return null;

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshPayload.jti },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date() || stored.user.status !== "ACTIVE") {
    return null;
  }

  return {
    id: stored.user.id,
    email: stored.user.email,
    name: stored.user.name,
    role: stored.user.role,
  };
}

export function toAuthUser(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export { signAccessToken } from "./auth-jwt";
