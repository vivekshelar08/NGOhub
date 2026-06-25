import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";

type RouteParams = { params: Promise<{ id: string; stepId: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "services.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { stepId } = await params;
  await prisma.serviceStep.delete({ where: { id: stepId } });
  return NextResponse.json({ ok: true });
}
