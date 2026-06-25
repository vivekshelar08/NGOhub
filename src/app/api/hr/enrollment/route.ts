import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { enrollmentInviteSchema } from "@/lib/validators";
import { generateInviteToken } from "@/lib/hr-utils";
import { ensureHrPolicySettings, serializePolicyFromDb, toInputJson } from "@/lib/hr-profile";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.enrollment")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.enrollmentInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return NextResponse.json({
    invites: invites.map((inv) => ({
      ...inv,
      shareUrl: `${baseUrl}/enroll/${inv.token}`,
      isExpired: inv.expiresAt < new Date() && !inv.usedAt,
      isUsed: !!inv.usedAt,
    })),
  });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.enrollment")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = enrollmentInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await ensureHrPolicySettings(prisma);
  const orgDefaults = serializePolicyFromDb(
    await prisma.hrPolicySettings.findUniqueOrThrow({ where: { id: "default" } })
  );

  const { email, name, role, department, expiresInDays, payroll, leave, lateMark, employeePreset } =
    parsed.data;

  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const invite = await prisma.enrollmentInvite.create({
    data: {
      token,
      email: email?.toLowerCase(),
      name,
      role,
      department,
      expiresAt,
      createdById: currentUser.id,
      payrollSettings: toInputJson(payroll ?? orgDefaults.payroll),
      leaveSettings: toInputJson(leave ?? orgDefaults.leave),
      lateMarkSettings: toInputJson(lateMark ?? orgDefaults.lateMark),
      employeePreset: employeePreset ? toInputJson(employeePreset) : undefined,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const shareUrl = `${baseUrl}/enroll/${invite.token}`;

  return NextResponse.json({ invite: { ...invite, shareUrl } }, { status: 201 });
}
