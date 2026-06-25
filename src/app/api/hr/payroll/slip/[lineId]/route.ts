import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { buildSalarySlipData } from "@/lib/salary-slip";
import { ensureHrPolicySettings, serializePolicyFromDb } from "@/lib/hr-profile";

async function loadSlipForLine(lineId: string) {
  const line = await prisma.payrollLine.findUnique({
    where: { id: lineId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          employeeProfile: true,
        },
      },
      payrollRun: true,
    },
  });

  if (!line) return null;

  await ensureHrPolicySettings(prisma);
  const orgPolicy = serializePolicyFromDb(
    await prisma.hrPolicySettings.findUniqueOrThrow({ where: { id: "default" } })
  );

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      userId: line.userId,
      date: { gte: line.payrollRun.periodStart, lte: line.payrollRun.periodEnd },
    },
    select: { status: true, isLateMark: true },
  });

  const slip = buildSalarySlipData({
    lineId: line.id,
    payrollRun: line.payrollRun,
    user: line.user,
    employeeProfile: line.user.employeeProfile,
    payrollLine: line,
    orgPayrollSettings: orgPolicy.payroll,
    attendanceRecords,
    organizationName: process.env.NEXT_PUBLIC_ORG_NAME ?? "NGO Hub",
  });

  return { slip, userId: line.userId, payrollStatus: line.payrollRun.status };
}

type RouteParams = { params: Promise<{ lineId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { lineId } = await params;
  const result = await loadSlipForLine(lineId);
  if (!result) {
    return NextResponse.json({ error: "Salary slip not found" }, { status: 404 });
  }

  const isOwn = result.userId === currentUser.id;
  const isHr = hasFeature(currentUser.role, "hr.payroll");

  if (!isOwn && !isHr) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isHr && !["PROCESSED", "PAID"].includes(result.payrollStatus)) {
    return NextResponse.json({ error: "Salary slip not yet available" }, { status: 403 });
  }

  return NextResponse.json({ slip: result.slip });
}
