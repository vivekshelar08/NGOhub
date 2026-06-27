import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseDateOnly } from "@/lib/hr-utils";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/role-features";
import { activityRequestActionSchema, activityRequestSchema } from "@/lib/validators";
import {
  notifyActivityRequestOutcome,
  notifyCalendarApprovers,
} from "@/lib/calendar-notifications";

function serializeRequest(
  request: {
    id: string;
    title: string;
    description: string | null;
    workType: string;
    scheduledDate: Date;
    endDate: Date | null;
    projectId: string | null;
    status: string;
    reviewNotes: string | null;
    createdAt: Date;
    requestedBy: { id: string; name: string; department: string | null };
    reviewedBy?: { id: string; name: string } | null;
  }
) {
  return {
    id: request.id,
    title: request.title,
    description: request.description,
    workType: request.workType,
    scheduledDate: request.scheduledDate.toISOString().slice(0, 10),
    endDate: request.endDate?.toISOString().slice(0, 10) ?? null,
    projectId: request.projectId,
    status: request.status,
    reviewNotes: request.reviewNotes,
    requestedById: request.requestedBy.id,
    requestedByName: request.requestedBy.name,
    department: request.requestedBy.department,
    reviewedByName: request.reviewedBy?.name,
    createdAt: request.createdAt.toISOString(),
  };
}

const requestInclude = {
  requestedBy: { select: { id: true, name: true, department: true } },
  reviewedBy: { select: { id: true, name: true } },
} as const;

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "calendar.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const viewAll = searchParams.get("all") === "1" && hasFeature(currentUser.role, "calendar.approve");
  const status = searchParams.get("status");

  const where: {
    requestedById?: string;
    status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    scheduledDate?: { gte?: Date; lte?: Date };
  } = {};

  if (!viewAll) {
    where.requestedById = currentUser.id;
  }

  if (status && ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
    where.status = status as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  }

  if (from || to) {
    where.scheduledDate = {};
    if (from) where.scheduledDate.gte = parseDateOnly(from);
    if (to) where.scheduledDate.lte = parseDateOnly(to);
  }

  const requests = await prisma.activityRequest.findMany({
    where,
    include: requestInclude,
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    take: viewAll ? 200 : 100,
  });

  return NextResponse.json({
    requests: requests.map(serializeRequest),
  });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "calendar.request")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = activityRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const scheduledDate = parseDateOnly(parsed.data.scheduledDate);
  const endDate = parsed.data.endDate ? parseDateOnly(parsed.data.endDate) : null;

  if (endDate && endDate < scheduledDate) {
    return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 });
  }

  const created = await prisma.activityRequest.create({
    data: {
      requestedById: currentUser.id,
      title: parsed.data.title,
      description: parsed.data.description,
      workType: parsed.data.workType,
      scheduledDate,
      endDate,
      projectId: parsed.data.projectId,
    },
    include: requestInclude,
  });

  try {
    await notifyCalendarApprovers(prisma, {
      title: created.title,
      requesterName: created.requestedBy.name,
      scheduledDate: created.scheduledDate.toISOString().slice(0, 10),
      excludeUserId: currentUser.id,
    });
  } catch (error) {
    console.error("Activity request approver notification failed:", error);
  }

  return NextResponse.json({ request: serializeRequest(created) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...actionBody } = body as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "Request id required" }, { status: 400 });
  }

  const parsed = activityRequestActionSchema.safeParse(actionBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.activityRequest.findUnique({
    where: { id },
    include: requestInclude,
  });

  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (parsed.data.action === "cancel") {
    if (existing.requestedById !== currentUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "Only pending requests can be cancelled" }, { status: 400 });
    }

    const updated = await prisma.activityRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: requestInclude,
    });
    return NextResponse.json({ request: serializeRequest(updated) });
  }

  if (!hasFeature(currentUser.role, "calendar.approve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "Request already processed" }, { status: 400 });
  }

  const updated = await prisma.activityRequest.update({
    where: { id },
    data: {
      status: parsed.data.action === "approve" ? "APPROVED" : "REJECTED",
      reviewedById: currentUser.id,
      reviewedAt: new Date(),
      reviewNotes: parsed.data.reviewNotes,
    },
    include: requestInclude,
  });

  try {
    await notifyActivityRequestOutcome(prisma, {
      requesterId: updated.requestedBy.id,
      title: updated.title,
      approved: parsed.data.action === "approve",
      scheduledDate: updated.scheduledDate.toISOString().slice(0, 10),
      reviewNotes: updated.reviewNotes,
    });
  } catch (error) {
    console.error("Activity request outcome notification failed:", error);
  }

  return NextResponse.json({ request: serializeRequest(updated) });
}
