import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { serviceSchema, serviceStepSchema } from "@/lib/validators";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.list")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { stepOrder: "asc" } },
      _count: { select: { deliveries: true } },
    },
  });

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  return NextResponse.json({ service });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "services.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = serviceSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const service = await prisma.service.update({
    where: { id },
    data: parsed.data,
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  return NextResponse.json({ service });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "services.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.service.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "services.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = serviceStepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const step = await prisma.serviceStep.create({
    data: { serviceId: id, ...parsed.data },
  });

  return NextResponse.json({ step }, { status: 201 });
}
