import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { leaveApplicationSchema, leaveActionSchema } from "@/lib/validators";
import { parseDateOnly, decimalToNumber } from "@/lib/hr-utils";
import { initLeaveBalance, serializePolicyFromDb } from "@/lib/hr-profile";
import {
  buildLeaveBalanceSummary,
  countLeaveDays,
  getLeaveTypeBalance,
  sumPendingLeaveDays,
  type LeaveTypeCode,
} from "@/lib/leave-balance";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.attendance")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const viewAll = searchParams.get("all") === "1" && hasFeature(currentUser.role, "hr.manage");

  const year = new Date().getFullYear();

  const profile = await prisma.employeeProfile.findUnique({
    where: { userId: currentUser.id },
    include: {
      leaveBalances: { where: { year } },
    },
  });

  let balanceRecord = profile?.leaveBalances[0] ?? null;
  if (profile && !balanceRecord) {
    const settings = await prisma.hrPolicySettings.findUniqueOrThrow({ where: { id: "default" } });
    await initLeaveBalance(prisma, profile.id, serializePolicyFromDb(settings).leave, year);
    balanceRecord = await prisma.employeeLeaveBalance.findUnique({
      where: { employeeProfileId_year: { employeeProfileId: profile.id, year } },
    });
  }

  const pendingApplications = profile
    ? await prisma.leaveApplication.findMany({
        where: { employeeProfileId: profile.id, status: "PENDING" },
      })
    : [];

  const applications = viewAll
    ? await prisma.leaveApplication.findMany({
        include: {
          employeeProfile: {
            include: { user: { select: { id: true, name: true, department: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : profile
      ? await prisma.leaveApplication.findMany({
          where: { employeeProfileId: profile.id },
          include: {
            employeeProfile: {
              include: { user: { select: { id: true, name: true, department: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  const balance = balanceRecord
    ? buildLeaveBalanceSummary(balanceRecord, sumPendingLeaveDays(pendingApplications, year))
    : null;

  return NextResponse.json({
    balance,
    applications: applications.map((a) => ({
      id: a.id,
      leaveType: a.leaveType,
      startDate: a.startDate.toISOString().slice(0, 10),
      endDate: a.endDate.toISOString().slice(0, 10),
      days: decimalToNumber(a.days),
      reason: a.reason,
      status: a.status,
      employeeName: a.employeeProfile.user.name,
      department: a.employeeProfile.user.department,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.attendance")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = leaveApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const profile = await prisma.employeeProfile.findUnique({ where: { userId: currentUser.id } });
  if (!profile) {
    return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
  }

  const startDate = parseDateOnly(parsed.data.startDate);
  const endDate = parseDateOnly(parsed.data.endDate);
  if (endDate < startDate) {
    return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 });
  }

  const days = countLeaveDays(startDate, endDate);
  const year = startDate.getFullYear();
  const leaveType = parsed.data.leaveType as LeaveTypeCode;

  let balanceRecord = await prisma.employeeLeaveBalance.findUnique({
    where: { employeeProfileId_year: { employeeProfileId: profile.id, year } },
  });

  if (!balanceRecord) {
    const settings = await prisma.hrPolicySettings.findUniqueOrThrow({ where: { id: "default" } });
    await initLeaveBalance(prisma, profile.id, serializePolicyFromDb(settings).leave, year);
    balanceRecord = await prisma.employeeLeaveBalance.findUniqueOrThrow({
      where: { employeeProfileId_year: { employeeProfileId: profile.id, year } },
    });
  }

  const pendingApplications = await prisma.leaveApplication.findMany({
    where: { employeeProfileId: profile.id, status: "PENDING" },
  });
  const summary = buildLeaveBalanceSummary(
    balanceRecord,
    sumPendingLeaveDays(pendingApplications, year)
  );
  const typeBalance = getLeaveTypeBalance(summary, leaveType);

  if (days > typeBalance.available) {
    return NextResponse.json(
      {
        error: `Insufficient ${leaveType} balance. ${typeBalance.available} day(s) available (${typeBalance.used} used, ${typeBalance.pending} pending approval).`,
      },
      { status: 400 }
    );
  }

  const application = await prisma.leaveApplication.create({
    data: {
      employeeProfileId: profile.id,
      leaveType: parsed.data.leaveType,
      startDate,
      endDate,
      days,
      reason: parsed.data.reason,
    },
  });

  return NextResponse.json({ application }, { status: 201 });
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...actionBody } = body as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "Application id required" }, { status: 400 });
  }

  const parsed = leaveActionSchema.safeParse(actionBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const application = await prisma.leaveApplication.findUnique({
    where: { id },
    include: { employeeProfile: true },
  });

  if (!application || application.status !== "PENDING") {
    return NextResponse.json({ error: "Application not found or already processed" }, { status: 404 });
  }

  if (parsed.data.action === "reject") {
    const updated = await prisma.leaveApplication.update({
      where: { id },
      data: { status: "REJECTED", approvedById: currentUser.id, approvedAt: new Date() },
    });
    return NextResponse.json({ application: updated });
  }

  const year = application.startDate.getFullYear();
  const balance = await prisma.employeeLeaveBalance.findUnique({
    where: { employeeProfileId_year: { employeeProfileId: application.employeeProfileId, year } },
  });

  if (!balance) {
    return NextResponse.json({ error: "Leave balance not initialized" }, { status: 400 });
  }

  const days = Number(application.days.toString());
  const leaveField =
    application.leaveType === "CL"
      ? "casualLeaveUsed"
      : application.leaveType === "SL"
        ? "sickLeaveUsed"
        : "earnedLeaveUsed";
  const totalField =
    application.leaveType === "CL"
      ? "casualLeaveTotal"
      : application.leaveType === "SL"
        ? "sickLeaveTotal"
        : "earnedLeaveTotal";

  const used = balance[leaveField as keyof typeof balance] as number;
  const total = balance[totalField as keyof typeof balance] as number;

  if (used + days > total) {
    return NextResponse.json({ error: "Insufficient leave balance" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const app = await tx.leaveApplication.update({
      where: { id },
      data: { status: "APPROVED", approvedById: currentUser.id, approvedAt: new Date() },
    });

    await tx.employeeLeaveBalance.update({
      where: { id: balance.id },
      data: { [leaveField]: used + days },
    });

    return app;
  });

  return NextResponse.json({ application: updated });
}
