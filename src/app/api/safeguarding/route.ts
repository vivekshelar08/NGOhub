import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { z } from "zod";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "reports.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const incidents = await prisma.safeguardingIncident.findMany({
    where: projectId ? { projectId } : undefined,
    include: { reportedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ incidents });
}

const createSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const incident = await prisma.safeguardingIncident.create({
    data: {
      ...parsed.data,
      reportedById: user.id,
    },
    include: { reportedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ incident });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "admin.access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = body.id as string;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const incident = await prisma.safeguardingIncident.update({
    where: { id },
    data: { status: body.status, severity: body.severity },
    include: { reportedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ incident });
}
