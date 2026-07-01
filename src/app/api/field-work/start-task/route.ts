import { NextResponse } from "next/server";
import type { ActivityTask } from "@/lib/activities";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { todayDateOnly } from "@/lib/hr-utils";
import {
  getTodayAttendanceRecord,
  performPunchIn,
} from "@/lib/attendance-punch-server";
import { isFieldWorkType, type PunchLocationType } from "@/lib/field-work";
import { isPrismaSchemaMismatch, schemaMismatchMessage } from "@/lib/api-db-safe";

function rowToTask(row: { payload: unknown }): ActivityTask | null {
  if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) return null;
  return row.payload as ActivityTask;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "field_activities")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const taskId = String(body.taskId ?? "").trim();
  const latitude = typeof body.latitude === "number" ? body.latitude : undefined;
  const longitude = typeof body.longitude === "number" ? body.longitude : undefined;

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  try {
    const row = await prisma.fieldActivityTask.findUnique({ where: { id: taskId } });
  if (!row) {
    return NextResponse.json({ error: "Task not found on server" }, { status: 404 });
  }

  const task = rowToTask(row);
  if (!task || task.assignedToUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (task.status !== "assigned") {
    return NextResponse.json({ error: "Task is not in assigned state" }, { status: 400 });
  }

  const policy = await prisma.hrPolicySettings.findUniqueOrThrow({ where: { id: "default" } });
  const today = todayDateOnly();
  const now = new Date();
  let attendanceRecord = await getTodayAttendanceRecord(prisma, user.id, today);

  if (attendanceRecord?.status === "LEAVE") {
    return NextResponse.json(
      { error: "You are marked on leave today. Contact your manager if you are working." },
      { status: 403 }
    );
  }

  const fieldWork = isFieldWorkType(task.workType);
  const locationType: PunchLocationType = fieldWork ? "FIELD" : "OFFICE";
  const hadPunchIn = Boolean(attendanceRecord?.punchIn);

  if (fieldWork && policy.requirePunchForFieldTasks && !hadPunchIn) {
    if (!policy.autoPunchOnTaskStart) {
      return NextResponse.json(
        {
          error: "Punch in before starting field work.",
          code: "PUNCH_REQUIRED",
        },
        { status: 403 }
      );
    }
    attendanceRecord = await performPunchIn(prisma, user.id, today, now, {
      latitude,
      longitude,
      locationType,
    });
  } else if (!hadPunchIn && policy.autoPunchOnTaskStart) {
    attendanceRecord = await performPunchIn(prisma, user.id, today, now, {
      latitude,
      longitude,
      locationType,
    });
  }

  const visit = await prisma.fieldVisitLog.create({
    data: {
      userId: user.id,
      taskId: task.id,
      projectId: task.projectId,
      attendanceRecordId: attendanceRecord?.id,
      workType: task.workType,
      startedAt: now,
      startLatitude: latitude,
      startLongitude: longitude,
    },
  });

  return NextResponse.json({
    ok: true,
    visitId: visit.id,
    punchedIn: Boolean(attendanceRecord?.punchIn),
    autoPunched: !hadPunchIn && Boolean(attendanceRecord?.punchIn),
  });
  } catch (error) {
    if (isPrismaSchemaMismatch(error)) {
      return NextResponse.json(
        { error: schemaMismatchMessage(), code: "SCHEMA_PENDING", schemaPending: true },
        { status: 503 }
      );
    }
    throw error;
  }
}
