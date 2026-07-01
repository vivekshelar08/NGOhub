import { PrismaClient } from "@/generated/prisma/client";
import { LeaveApplicationStatus } from "@/generated/prisma/enums";

/** Returns user IDs on approved leave for a given date (blocks field assignment). */
export async function getUsersOnLeaveForDate(prisma: PrismaClient, date: Date) {
  const day = date.toISOString().slice(0, 10);
  const leaves = await prisma.leaveApplication.findMany({
    where: {
      status: LeaveApplicationStatus.APPROVED,
      startDate: { lte: new Date(day) },
      endDate: { gte: new Date(day) },
    },
    include: {
      employeeProfile: { select: { userId: true, user: { select: { id: true, name: true } } } },
    },
  });

  return leaves.map((l) => ({
    userId: l.employeeProfile.userId,
    userName: l.employeeProfile.user.name,
    leaveType: l.leaveType,
    isEmergency: l.isEmergency,
    reason: l.reason,
    startDate: l.startDate.toISOString().slice(0, 10),
    endDate: l.endDate.toISOString().slice(0, 10),
  }));
}

import { isEmergencyLeave } from "@/lib/leave-shared";

export { isEmergencyLeave };

export async function canAssignFieldWork(
  prisma: PrismaClient,
  userId: string,
  scheduledDate: Date
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const onLeave = await getUsersOnLeaveForDate(prisma, scheduledDate);
  const blocked = onLeave.find((l) => l.userId === userId);
  if (blocked) {
    return {
      ok: false,
      reason: `${blocked.userName} is on ${blocked.leaveType} leave (${blocked.startDate} – ${blocked.endDate})`,
    };
  }
  return { ok: true };
}

export async function getProjectAvailabilityCalendar(
  prisma: PrismaClient,
  projectId: string,
  month: number,
  year: number
) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));

  const [requests, leaves] = await Promise.all([
    prisma.activityRequest.findMany({
      where: {
        projectId,
        scheduledDate: { gte: start, lte: end },
        status: "APPROVED",
      },
      include: { requestedBy: { select: { id: true, name: true } } },
    }),
    prisma.leaveApplication.findMany({
      where: {
        status: LeaveApplicationStatus.APPROVED,
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: {
        employeeProfile: { select: { userId: true, user: { select: { name: true } } } },
      },
    }),
  ]);

  return {
    month,
    year,
    projectId,
    fieldDays: requests.map((r) => ({
      date: r.scheduledDate.toISOString().slice(0, 10),
      title: r.title,
      userId: r.requestedById,
      userName: r.requestedBy.name,
    })),
    leaveBlocks: leaves.map((l) => ({
      userId: l.employeeProfile.userId,
      userName: l.employeeProfile.user.name,
      startDate: l.startDate.toISOString().slice(0, 10),
      endDate: l.endDate.toISOString().slice(0, 10),
    })),
  };
}
