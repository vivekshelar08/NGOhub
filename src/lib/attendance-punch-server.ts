import type { PrismaClient } from "@/generated/prisma/client";
import { isPrismaSchemaMismatch } from "@/lib/api-db-safe";
import {
  computeLateStatus,
  ensureHrPolicySettings,
  resolveLateMarkSettings,
  serializePolicyFromDb,
} from "@/lib/hr-profile";
import type { PunchLocationType } from "@/lib/field-work";

type PunchGpsOptions = {
  latitude?: number;
  longitude?: number;
  locationType?: PunchLocationType;
};

function punchInGpsFields(options?: PunchGpsOptions) {
  if (options?.latitude == null || options?.longitude == null) return {};
  return {
    punchInLatitude: options.latitude,
    punchInLongitude: options.longitude,
    ...(options.locationType ? { punchInLocationType: options.locationType } : {}),
  };
}

function punchOutGpsFields(options?: PunchGpsOptions) {
  if (options?.latitude == null || options?.longitude == null) return {};
  return {
    punchOutLatitude: options.latitude,
    punchOutLongitude: options.longitude,
    ...(options.locationType ? { punchOutLocationType: options.locationType } : {}),
  };
}

export async function performPunchIn(
  prisma: PrismaClient,
  userId: string,
  today: Date,
  now: Date,
  options?: PunchGpsOptions & { skipLateCheck?: boolean }
) {
  await ensureHrPolicySettings(prisma);
  const orgPolicy = serializePolicyFromDb(
    await prisma.hrPolicySettings.findUniqueOrThrow({ where: { id: "default" } })
  );
  const profile = await prisma.employeeProfile.findUnique({ where: { userId } });
  const lateSettings = resolveLateMarkSettings(profile, orgPolicy);
  const late = options?.skipLateCheck
    ? { lateMinutes: 0, isLateMark: false, status: "PRESENT" as const }
    : computeLateStatus(now, lateSettings);

  const baseCreate = {
    userId,
    date: today,
    punchIn: now,
    status: late.status,
    lateMinutes: late.lateMinutes,
    isLateMark: late.isLateMark,
  };
  const baseUpdate = {
    punchIn: now,
    status: late.status,
    lateMinutes: late.lateMinutes,
    isLateMark: late.isLateMark,
  };
  const gps = punchInGpsFields(options);

  try {
    return await prisma.attendanceRecord.upsert({
      where: { userId_date: { userId, date: today } },
      create: { ...baseCreate, ...gps },
      update: { ...baseUpdate, ...gps },
    });
  } catch (error) {
    if (Object.keys(gps).length > 0 && isPrismaSchemaMismatch(error)) {
      return prisma.attendanceRecord.upsert({
        where: { userId_date: { userId, date: today } },
        create: baseCreate,
        update: baseUpdate,
      });
    }
    throw error;
  }
}

export async function performPunchOut(
  prisma: PrismaClient,
  recordId: string,
  now: Date,
  options?: PunchGpsOptions
) {
  const base = { punchOut: now };
  const gps = punchOutGpsFields(options);

  try {
    return await prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { ...base, ...gps },
    });
  } catch (error) {
    if (Object.keys(gps).length > 0 && isPrismaSchemaMismatch(error)) {
      return prisma.attendanceRecord.update({
        where: { id: recordId },
        data: base,
      });
    }
    throw error;
  }
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
