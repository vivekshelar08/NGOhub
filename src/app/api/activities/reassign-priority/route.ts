import { NextResponse } from "next/server";
import type { ActivityTask } from "@/lib/activities";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { prisma } from "@/lib/prisma";
import { todayDateOnly } from "@/lib/hr-utils";
import { isEmergencyLeave } from "@/lib/leave-shared";
import { LeaveApplicationStatus } from "@/generated/prisma/enums";

function rowToTask(row: { payload: unknown }): ActivityTask | null {
  if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) return null;
  return row.payload as ActivityTask;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "activities.assign")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = todayDateOnly();

  const emergencyLeaves = await prisma.leaveApplication.findMany({
    where: {
      status: LeaveApplicationStatus.APPROVED,
      endDate: { gte: today },
      OR: [{ isEmergency: true }, { leaveType: "EM" }],
    },
    include: {
      employeeProfile: {
        include: { user: { select: { id: true, name: true, department: true } } },
      },
    },
  });

  const emergencyUserIds = emergencyLeaves.map((l) => l.employeeProfile.userId);
  if (emergencyUserIds.length === 0) {
    return NextResponse.json({ tasks: [], leaveCount: 0 });
  }

  const rows = await prisma.fieldActivityTask.findMany({
    where: {
      assignedToUserId: { in: emergencyUserIds },
      status: { in: ["assigned", "active"] },
    },
    orderBy: [{ scheduledDate: "asc" }, { updatedAt: "desc" }],
  });

  const leaveByUser = new Map(
    emergencyLeaves.map((l) => [l.employeeProfile.userId, l])
  );

  const tasks = rows
    .map((row) => {
      const task = rowToTask(row);
      if (!task) return null;
      const leave = leaveByUser.get(task.assignedToUserId);
      if (!leave) return null;
      return {
        task,
        assigneeName: leave.employeeProfile.user.name,
        assigneeDepartment: leave.employeeProfile.user.department,
        leaveType: leave.leaveType,
        leaveStart: leave.startDate.toISOString().slice(0, 10),
        leaveEnd: leave.endDate.toISOString().slice(0, 10),
        isEmergency: isEmergencyLeave(leave),
        priority: leave.isEmergency || leave.leaveType === "EM" ? "high" : "medium",
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  tasks.sort((a, b) => {
    const dateA = (a.task.scheduledDate ?? a.task.createdAt).slice(0, 10);
    const dateB = (b.task.scheduledDate ?? b.task.createdAt).slice(0, 10);
    return dateA.localeCompare(dateB);
  });

  return NextResponse.json({ tasks, leaveCount: emergencyLeaves.length });
}
