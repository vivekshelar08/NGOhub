import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { haversineKm, isFieldWorkType } from "@/lib/field-work";
import { isPrismaSchemaMismatch } from "@/lib/api-db-safe";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "field_activities")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const taskId = String(body.taskId ?? "").trim();
  const latitude = typeof body.latitude === "number" ? body.latitude : undefined;
  const longitude = typeof body.longitude === "number" ? body.longitude : undefined;
  const locationLabel = typeof body.locationLabel === "string" ? body.locationLabel.trim() : undefined;

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  try {
    const visit = await prisma.fieldVisitLog.findFirst({
    where: { taskId, userId: user.id, completedAt: null },
    orderBy: { startedAt: "desc" },
  });

  if (!visit) {
    return NextResponse.json({ error: "No active field visit for this task" }, { status: 404 });
  }

  const now = new Date();
  let conveyanceKm: number | undefined;
  if (
    visit.startLatitude != null &&
    visit.startLongitude != null &&
    latitude != null &&
    longitude != null &&
    isFieldWorkType(visit.workType)
  ) {
    conveyanceKm = haversineKm(visit.startLatitude, visit.startLongitude, latitude, longitude);
  }

  const updated = await prisma.fieldVisitLog.update({
    where: { id: visit.id },
    data: {
      completedAt: now,
      endLatitude: latitude,
      endLongitude: longitude,
      conveyanceTo: locationLabel,
      conveyanceKm,
    },
  });

  const attendance = visit.attendanceRecordId
    ? await prisma.attendanceRecord.findUnique({ where: { id: visit.attendanceRecordId } })
    : null;

  if (attendance && latitude != null && longitude != null) {
    await prisma.attendanceRecord.update({
      where: { id: attendance.id },
      data: {
        punchOutLatitude: latitude,
        punchOutLongitude: longitude,
        punchOutLocationType: isFieldWorkType(visit.workType) ? "FIELD" : "OFFICE",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    visit: updated,
    conveyanceDraft:
      conveyanceKm != null
        ? {
            from: "Field start GPS",
            to: locationLabel ?? "Task completion GPS",
            km: conveyanceKm,
          }
        : null,
  });
  } catch (error) {
    if (isPrismaSchemaMismatch(error)) {
      return NextResponse.json({ ok: true, schemaPending: true });
    }
    throw error;
  }
}
