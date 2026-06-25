import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { serviceSchema } from "@/lib/validators";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.list")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const services = await prisma.service.findMany({
    include: {
      steps: { orderBy: { stepOrder: "asc" } },
      _count: { select: { deliveries: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ services });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "services.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const service = await prisma.service.create({
    data: parsed.data,
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  return NextResponse.json({ service }, { status: 201 });
}
