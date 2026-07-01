import type { PrismaClient } from "@/generated/prisma/client";
import { eachDateKey } from "@/lib/hr-utils";

type DbClient = PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use">;

/** Mark attendance as LEAVE for each day in an approved leave application. */
export async function syncAttendanceForLeaveApplication(
  prisma: DbClient,
  application: {
    id: string;
    employeeProfile: { userId: string };
    startDate: Date;
    endDate: Date;
  }
): Promise<void> {
  const userId = application.employeeProfile.userId;
  const start = application.startDate.toISOString().slice(0, 10);
  const end = application.endDate.toISOString().slice(0, 10);

  for (const dateKey of eachDateKey(start, end)) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    await prisma.attendanceRecord.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        status: "LEAVE",
        leaveApplicationId: application.id,
        notes: "Auto-marked from approved leave",
      },
      update: {
        status: "LEAVE",
        leaveApplicationId: application.id,
        notes: "Auto-marked from approved leave",
      },
    });
  }
}
