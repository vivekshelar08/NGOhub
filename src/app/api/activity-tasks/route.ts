import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import type { ActivityTask } from "@/lib/activities";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

function rowToTask(row: {
  id: string;
  payload: Prisma.JsonValue;
}): ActivityTask | null {
  if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) {
    return null;
  }
  return row.payload as unknown as ActivityTask;
}

function taskScheduledDate(task: ActivityTask): string | null {
  return (task.scheduledDate ?? task.rescheduledTo ?? task.createdAt)?.slice(0, 10) ?? null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scopeAll = searchParams.get("scope") === "all";
  const projectIds = searchParams
    .get("projectIds")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  let where: Prisma.FieldActivityTaskWhereInput;

  if (scopeAll && (user.role === "ADMIN" || user.role === "MANAGER")) {
    where = {};
  } else {
    const or: Prisma.FieldActivityTaskWhereInput[] = [
      { assignedToUserId: user.id },
      { assignedByUserId: user.id },
    ];
    if (projectIds && projectIds.length > 0) {
      or.push({ projectId: { in: projectIds } });
    }
    where = { OR: or };
  }

  const rows = await prisma.fieldActivityTask.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  const tasks = rows.map(rowToTask).filter((t): t is ActivityTask => t !== null);
  return NextResponse.json({ tasks });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "field_activities")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const task = body.task as ActivityTask | undefined;
  if (!task?.id || !task.title || !task.assignedToUserId || !task.projectId) {
    return NextResponse.json({ error: "Invalid task payload" }, { status: 400 });
  }

  const canWrite =
    user.role === "ADMIN" ||
    user.role === "MANAGER" ||
    task.assignedByUserId === user.id ||
    task.assignedToUserId === user.id ||
    hasPermission(user.role, "manage_projects");

  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.fieldActivityTask.upsert({
    where: { id: task.id },
    create: {
      id: task.id,
      assignedToUserId: task.assignedToUserId,
      assignedByUserId: task.assignedByUserId,
      projectId: task.projectId,
      scheduledDate: taskScheduledDate(task),
      status: task.status,
      payload: task as unknown as Prisma.InputJsonValue,
    },
    update: {
      assignedToUserId: task.assignedToUserId,
      assignedByUserId: task.assignedByUserId,
      projectId: task.projectId,
      scheduledDate: taskScheduledDate(task),
      status: task.status,
      payload: task as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: true, task });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "field_activities")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Task id is required" }, { status: 400 });
  }

  const existing = await prisma.fieldActivityTask.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ ok: true });
  }

  const canDelete =
    user.role === "ADMIN" ||
    user.role === "MANAGER" ||
    existing.assignedByUserId === user.id;

  if (!canDelete) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.fieldActivityTask.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
