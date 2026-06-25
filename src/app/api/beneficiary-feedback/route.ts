import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { z } from "zod";

const createSchema = z.object({
  beneficiaryId: z.string().uuid(),
  type: z.enum(["FEEDBACK", "COMPLAINT", "SATISFACTION"]),
  note: z.string().min(1),
  rating: z.number().int().min(1).max(5).optional(),
});

const patchSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  resolution: z.string().optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.list")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const beneficiaryId = new URL(request.url).searchParams.get("beneficiaryId");
  if (!beneficiaryId) {
    return NextResponse.json({ error: "beneficiaryId required" }, { status: 400 });
  }

  const items = await prisma.beneficiaryFeedback.findMany({
    where: { beneficiaryId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    feedback: items.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      resolvedAt: f.resolvedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
  }

  const item = await prisma.beneficiaryFeedback.create({
    data: { ...parsed.data, createdById: user.id },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    feedback: {
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = body.id as string;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "RESOLVED" || parsed.data.status === "CLOSED") {
    data.resolvedAt = new Date();
  }

  const item = await prisma.beneficiaryFeedback.update({
    where: { id },
    data,
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    feedback: {
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      resolvedAt: item.resolvedAt?.toISOString() ?? null,
    },
  });
}
