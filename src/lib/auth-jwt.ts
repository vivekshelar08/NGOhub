import { SignJWT, jwtVerify } from "jose";
import { Role } from "@/generated/prisma/enums";
import type { AccessTokenPayload, AuthUser, RefreshTokenPayload } from "@/types/auth";
import { ACCESS_TTL } from "./auth-constants";

function getAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not set");
  return new TextEncoder().encode(secret);
}

function getRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(user: AuthUser) {
  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    type: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(getAccessSecret());
}

export async function signRefreshToken(userId: string, jti: string) {
  return new SignJWT({ jti, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getRefreshSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAccessSecret());
    if (payload.type !== "access") return null;

    return {
      id: payload.sub!,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as Role,
      type: "access",
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getRefreshSecret());
    if (payload.type !== "refresh" || !payload.sub || !payload.jti) return null;

    return {
      sub: payload.sub,
      jti: payload.jti as string,
      type: "refresh",
    };
  } catch {
    return null;
  }
}

export async function verifyAccessTokenEdge(token: string) {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) return false;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload.type === "access";
  } catch {
    return false;
  }
}
