import { Role } from "@/generated/prisma/enums";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AccessTokenPayload extends AuthUser {
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: "refresh";
}
