import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { computePayrollAmounts, resolvePayrollSettings } from "@/lib/salary-slip";
import { ensureHrPolicySettings, parseJsonField, serializePolicyFromDb } from "@/lib/hr-profile";
import { decimalToNumber, parseDateOnly } from "@/lib/hr-utils";
import { payrollRunSchema } from "@/lib/validators";
import { DEFAULT_LATE_MARK_SETTINGS } from "@/lib/hr-types";

function serializePayrollRun(run: {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  notes: string | null;
  createdAt: Date;
  lines: Array<{
    id: string;
    userId: string;
    baseSalary: { toString(): string };
    deductions: { toString(): string };
    bonuses: { toString(): string };
    netPay: { toString(): string };
    user: { id: string; name: string; email: string; department: string | null };
  }>;
}) {
  return {
    id: run.id,
    periodStart: run.periodStart.toISOString().slice(0, 10),
    periodEnd: run.periodEnd.toISOString().slice(0, 10),
    status: run.status,
    notes: run.notes,
    createdAt: run.createdAt.toISOString(),
    lines: run.lines.map((line) => ({
      id: line.id,
      userId: line.userId,
      userName: line.user.name,
      userEmail: line.user.email,
      department: line.user.department,
      baseSalary: decimalToNumber(line.baseSalary),
      deductions: decimalToNumber(line.deductions),
      bonuses: decimalToNumber(line.bonuses),
      netPay: decimalToNumber(line.netPay),
    })),
  };
}

async function computeLineForUser(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
  orgPayroll: ReturnType<typeof serializePolicyFromDb>["payroll"]
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { employeeProfile: true },
  });
  if (!user?.employeeProfile) {
    return { baseSalary: 0, deductions: 0, bonuses: 0, netPay: 0 };
  }

  const profile = user.employeeProfile;
  const payrollSettings = resolvePayrollSettings(profile.payrollSettings, orgPayroll);
  const lateSettings = parseJsonField(profile.lateMarkSettings, DEFAULT_LATE_MARK_SETTINGS);

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: { userId, date: { gte: periodStart, lte: periodEnd } },
    select: { isLateMark: true },
  });
  const lateMarkCount = attendanceRecords.filter((r) => r.isLateMark).length;

  const basicSalary =
    decimalToNumber(profile.basicSalary) ?? decimalToNumber(profile.baseSalary) ?? 0;
  const hra = decimalToNumber(profile.hra) ?? 0;
  const conveyance = decimalToNumber(profile.conveyanceAllowance) ?? 0;
  const special = decimalToNumber(profile.specialAllowance) ?? 0;

  const computed = computePayrollAmounts({
    basicSalary,
    hra,
    conveyanceAllowance: conveyance,
    specialAllowance: special,
    bonuses: 0,
    payrollSettings,
    lateMarkCount,
    lateDeductionPerMark: lateSettings.lateDeductionPerMark ?? 0,
  });

  return {
    baseSalary: basicSalary,
    deductions: computed.totalDeductions,
    bonuses: 0,
    netPay: computed.netPay,
  };
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.payroll")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const runs = await prisma.payrollRun.findMany({
    include: {
      lines: {
        include: {
          user: { select: { id: true, name: true, email: true, department: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ runs: runs.map(serializePayrollRun) });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.payroll")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = payrollRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { periodStart, periodEnd, notes } = parsed.data;
  const start = parseDateOnly(periodStart);
  const end = parseDateOnly(periodEnd);

  await ensureHrPolicySettings(prisma);
  const orgPolicy = serializePolicyFromDb(
    await prisma.hrPolicySettings.findUniqueOrThrow({ where: { id: "default" } })
  );

  const staff = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  const lineData = await Promise.all(
    staff.map(async (user) => {
      const amounts = await computeLineForUser(user.id, start, end, orgPolicy.payroll);
      return { userId: user.id, ...amounts };
    })
  );

  const run = await prisma.payrollRun.create({
    data: {
      periodStart: start,
      periodEnd: end,
      notes,
      createdById: currentUser.id,
      lines: { create: lineData },
    },
    include: {
      lines: {
        include: {
          user: { select: { id: true, name: true, email: true, department: true } },
        },
      },
    },
  });

  return NextResponse.json({ run: serializePayrollRun(run) }, { status: 201 });
}
