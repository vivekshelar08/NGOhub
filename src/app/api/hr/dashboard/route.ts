import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { todayDateOnly } from "@/lib/hr-utils";
import { decimalToNumber } from "@/lib/hr-utils";
import { LEAVE_TYPE_LABELS } from "@/lib/hr-types";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = todayDateOnly();
  const todayStr = today.toISOString().slice(0, 10);

  const staff = await prisma.user.findMany({
    where: { status: "ACTIVE", role: { not: "ADMIN" } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      phone: true,
      employeeProfile: {
        select: { employeeCode: true, designation: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const todayAttendance = await prisma.attendanceRecord.findMany({
    where: { date: today },
    select: {
      userId: true,
      punchIn: true,
      punchOut: true,
      status: true,
      isLateMark: true,
      lateMinutes: true,
    },
  });

  const attendanceMap = new Map(todayAttendance.map((a) => [a.userId, a]));

  const onLeaveToday = await prisma.leaveApplication.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: today },
      endDate: { gte: today },
    },
    include: {
      employeeProfile: {
        include: { user: { select: { id: true } } },
      },
    },
  });

  const onLeaveUserIds = new Set(
    onLeaveToday.map((l) => l.employeeProfile.userId)
  );

  const staffToday = staff.map((member) => {
    const att = attendanceMap.get(member.id);
    let dayStatus: "ON_LEAVE" | "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "NOT_PUNCHED";

    if (onLeaveUserIds.has(member.id)) {
      dayStatus = "ON_LEAVE";
    } else if (!att) {
      dayStatus = "NOT_PUNCHED";
    } else if (att.status === "HALF_DAY") {
      dayStatus = "HALF_DAY";
    } else if (att.isLateMark) {
      dayStatus = "LATE";
    } else if (att.punchIn) {
      dayStatus = att.punchOut ? "PRESENT" : "PRESENT";
    } else {
      dayStatus = "ABSENT";
    }

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      department: member.department,
      phone: member.phone,
      employeeCode: member.employeeProfile?.employeeCode ?? null,
      designation: member.employeeProfile?.designation ?? null,
      dayStatus,
      punchIn: att?.punchIn?.toISOString() ?? null,
      punchOut: att?.punchOut?.toISOString() ?? null,
      lateMinutes: att?.lateMinutes ?? 0,
    };
  });

  const stats = {
    totalStaff: staff.length,
    present: staffToday.filter((s) => s.dayStatus === "PRESENT" || s.dayStatus === "LATE").length,
    onLeave: staffToday.filter((s) => s.dayStatus === "ON_LEAVE").length,
    late: staffToday.filter((s) => s.dayStatus === "LATE").length,
    halfDay: staffToday.filter((s) => s.dayStatus === "HALF_DAY").length,
    notPunched: staffToday.filter((s) => s.dayStatus === "NOT_PUNCHED").length,
    absent: staffToday.filter((s) => s.dayStatus === "ABSENT").length,
  };

  const pendingLeaves = await prisma.leaveApplication.findMany({
    where: { status: "PENDING" },
    include: {
      employeeProfile: {
        include: { user: { select: { id: true, name: true, department: true, email: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const latestPayroll = await prisma.payrollRun.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      lines: {
        select: { id: true, userId: true, netPay: true },
      },
    },
  });

  const pendingEnrollments = await prisma.enrollmentInvite.count({
    where: { usedAt: null, expiresAt: { gt: new Date() } },
  });

  return NextResponse.json({
    date: todayStr,
    stats,
    staffToday,
    pendingLeaves: pendingLeaves.map((l) => ({
      id: l.id,
      leaveType: l.leaveType,
      leaveTypeLabel: LEAVE_TYPE_LABELS[l.leaveType] ?? l.leaveType,
      startDate: l.startDate.toISOString().slice(0, 10),
      endDate: l.endDate.toISOString().slice(0, 10),
      days: decimalToNumber(l.days),
      reason: l.reason,
      employeeName: l.employeeProfile.user.name,
      employeeEmail: l.employeeProfile.user.email,
      department: l.employeeProfile.user.department,
      createdAt: l.createdAt.toISOString(),
    })),
    payroll: latestPayroll
      ? {
          id: latestPayroll.id,
          periodStart: latestPayroll.periodStart.toISOString().slice(0, 10),
          periodEnd: latestPayroll.periodEnd.toISOString().slice(0, 10),
          status: latestPayroll.status,
          staffCount: latestPayroll.lines.length,
          lines: latestPayroll.lines.map((line) => ({
            lineId: line.id,
            userId: line.userId,
            netPay: decimalToNumber(line.netPay),
          })),
        }
      : null,
    pendingEnrollments,
  });
}
