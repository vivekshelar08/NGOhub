import type { PrismaClient } from "@/generated/prisma/client";
import {
  computeLateStatus,
  resolveLateMarkSettings,
  serializePolicyFromDb,
} from "@/lib/hr-profile";
import type { PunchLocationType } from "@/lib/field-work";

export async function performPunchIn(
  prisma: PrismaClient,
  userId: string,
  today: Date,
  now: Date,
  options?: {
    latitude?: number;
    longitude?: number;
    locationType?: PunchLocationType;
    skipLateCheck?: boolean;
  }
) {
  const orgPolicy = serializePolicyFromDb(
    await prisma.hrPolicySettings.findUniqueOrThrow({ where: { id: "default" } })
  );
  const profile = await prisma.employeeProfile.findUnique({ where: { userId } });
  const lateSettings = resolveLateMarkSettings(profile, orgPolicy);
  const late = options?.skipLateCheck
    ? { lateMinutes: 0, isLateMark: false, status: "PRESENT" as const }
    : computeLateStatus(now, lateSettings);

  return prisma.attendanceRecord.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      date: today,
      punchIn: now,
      status: late.status,
      lateMinutes: late.lateMinutes,
      isLateMark: late.isLateMark,
      punchInLatitude: options?.latitude,
      punchInLongitude: options?.longitude,
      punchInLocationType: options?.locationType,
    },
    update: {
      punchIn: now,
      status: late.status,
      lateMinutes: late.lateMinutes,
      isLateMark: late.isLateMark,
      punchInLatitude: options?.latitude ?? undefined,
      punchInLongitude: options?.longitude ?? undefined,
      punchInLocationType: options?.locationType ?? undefined,
    },
  });
}

export async function getTodayAttendanceRecord(
  prisma: PrismaClient,
  userId: string,
  today: Date
) {
  return prisma.attendanceRecord.findUnique({
    where: { userId_date: { userId, date: today } },
  });
}
