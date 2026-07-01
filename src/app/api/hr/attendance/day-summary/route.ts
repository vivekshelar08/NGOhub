import { NextResponse } from "next/server";
import type { ActivityTask } from "@/lib/activities";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { prisma } from "@/lib/prisma";
import { todayDateOnly } from "@/lib/hr-utils";

function rowToTask(row: { payload: unknown }): ActivityTask | null {
  if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) return null;
  return row.payload as ActivityTask;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "hr.punch")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = todayDateOnly();
  const todayKey = today.toISOString().slice(0, 10);

  const [attendance, taskRows, visits] = await Promise.all([
    prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    }),
    prisma.fieldActivityTask.findMany({
      where: {
        assignedToUserId: user.id,
        status: { in: ["assigned", "active", "completed"] },
      },
    }),
    prisma.fieldVisitLog.findMany({
      where: {
        userId: user.id,
        startedAt: { gte: new Date(`${todayKey}T00:00:00.000Z`) },
      },
      orderBy: { startedAt: "asc" },
    }),
  ]);

  const tasks = taskRows
    .map(rowToTask)
    .filter((t): t is ActivityTask => t !== null)
    .filter((t) => {
      const d = (t.scheduledDate ?? t.rescheduledTo ?? t.createdAt).slice(0, 10);
      return d === todayKey || t.status === "active";
    });

  const assigned = tasks.filter((t) => t.status === "assigned").length;
  const active = tasks.filter((t) => t.status === "active").length;
  const completed = tasks.filter((t) => t.status === "completed" && t.completedAt?.startsWith(todayKey)).length;

  return NextResponse.json({
    date: todayKey,
    attendance,
    tasks: { assigned, active, completed, total: tasks.length },
    fieldVisits: visits.length,
    onLeave: attendance?.status === "LEAVE",
  });
}
