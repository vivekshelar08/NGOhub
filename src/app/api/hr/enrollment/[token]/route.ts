import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { enrollCompleteSchema } from "@/lib/validators";
import {
  buildProfileCreateData,
  parseJsonField,
  serializePolicyFromDb,
} from "@/lib/hr-profile";
import {
  HrPolicyBundle,
  McaEmployeeProfile,
} from "@/lib/hr-types";
import { ensureHrPolicySettings } from "@/lib/hr-profile";

type RouteParams = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params;
  const invite = await prisma.enrollmentInvite.findUnique({
    where: { token },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
  }

  if (invite.usedAt) {
    return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
  }

  await ensureHrPolicySettings(prisma);
  const orgDefaults = serializePolicyFromDb(
    await prisma.hrPolicySettings.findUniqueOrThrow({ where: { id: "default" } })
  );

  const policy: HrPolicyBundle = {
    payroll: parseJsonField(invite.payrollSettings, orgDefaults.payroll),
    leave: parseJsonField(invite.leaveSettings, orgDefaults.leave),
    lateMark: parseJsonField(invite.lateMarkSettings, orgDefaults.lateMark),
  };

  return NextResponse.json({
    invite: {
      email: invite.email,
      name: invite.name,
      role: invite.role,
      department: invite.department,
      expiresAt: invite.expiresAt.toISOString(),
      policy,
      employeePreset: parseJsonField<McaEmployeeProfile | null>(invite.employeePreset, null),
    },
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params;
  const invite = await prisma.enrollmentInvite.findUnique({
    where: { token },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
  }

  if (invite.usedAt) {
    return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
  }

  const body = await request.json();
  const parsed = enrollCompleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { name, email, password, phone, profile } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  if (invite.email && invite.email !== normalizedEmail) {
    return NextResponse.json({ error: "Email does not match the invite" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  await ensureHrPolicySettings(prisma);
  const orgDefaults = serializePolicyFromDb(
    await prisma.hrPolicySettings.findUniqueOrThrow({ where: { id: "default" } })
  );

  const policy: HrPolicyBundle = {
    payroll: parseJsonField(invite.payrollSettings, orgDefaults.payroll),
    leave: parseJsonField(invite.leaveSettings, orgDefaults.leave),
    lateMark: parseJsonField(invite.lateMarkSettings, orgDefaults.lateMark),
  };

  const preset = parseJsonField<McaEmployeeProfile | null>(invite.employeePreset, null);
  const mergedProfile: McaEmployeeProfile = {
    ...preset,
    ...profile,
    department: profile.department ?? invite.department ?? preset?.department,
    designation: profile.designation ?? preset?.designation,
    joinDate: profile.joinDate ?? new Date().toISOString().slice(0, 10),
  };

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name || invite.name || email.split("@")[0],
        role: invite.role,
        department: mergedProfile.department ?? invite.department,
        phone,
      },
    });

    const profileData = buildProfileCreateData(created.id, {
      ...mergedProfile,
      ...policy,
    });

    const employeeProfile = await tx.employeeProfile.create({ data: profileData });

    await tx.enrollmentInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    await tx.employeeLeaveBalance.create({
      data: {
        employeeProfileId: employeeProfile.id,
        year: new Date().getFullYear(),
        casualLeaveTotal: policy.leave.casualLeaveDays,
        sickLeaveTotal: policy.leave.sickLeaveDays,
        earnedLeaveTotal: policy.leave.earnedLeaveDays,
      },
    });

    return created;
  });

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    },
    { status: 201 }
  );
}
