import { createHash, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { mergeOrgSettings } from "@/lib/orgSettings";
import { buildPasswordResetEmail, getSmtpConfig, sendEmail } from "@/lib/mail";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_HOUR = 3;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export type ForgotPasswordResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { ok: false, error: "Enter a valid email address", status: 400 };
  }

  const smtp = await getSmtpConfig();
  if (!smtp) {
    return {
      ok: false,
      error: "Password reset email is not configured. Contact your administrator.",
      status: 503,
    };
  }

  const user = await prisma.user.findUnique({ where: { email: normalized } });

  // Always return success to avoid email enumeration
  if (!user || user.status !== "ACTIVE") {
    return { ok: true };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gte: oneHourAgo } },
  });
  if (recentCount >= MAX_REQUESTS_PER_HOUR) {
    return { ok: true };
  }

  const rawToken = randomUUID();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const orgRow = await prisma.orgSettings.findUnique({ where: { id: "default" } });
  const org = mergeOrgSettings(orgRow);
  const resetUrl = `${appBaseUrl()}/reset-password?token=${rawToken}`;
  const emailContent = buildPasswordResetEmail({
    name: user.name,
    resetUrl,
    orgName: org.orgName,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
  } catch (err) {
    console.error("Password reset email failed:", err);
    return {
      ok: false,
      error: "Could not send reset email. Try again later or contact support.",
      status: 500,
    };
  }

  return { ok: true };
}

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  if (!token?.trim()) {
    return { ok: false, error: "Reset link is invalid or expired", status: 400 };
  }
  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters", status: 400 };
  }

  const tokenHash = hashToken(token.trim());
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, error: "Reset link is invalid or expired", status: 400 };
  }
  if (record.user.status !== "ACTIVE") {
    return { ok: false, error: "Account is not active", status: 403 };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId, id: { not: record.id } },
    }),
  ]);

  return { ok: true };
}
