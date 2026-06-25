import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { deliveryScopeOwnOnly } from "@/lib/delivery-permissions";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.list")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId")?.trim();

  const now = new Date();

  const deliveryWhere = {
    status: "DATA_ENTERED" as const,
    ...(deliveryScopeOwnOnly(user.role) ? { enteredById: user.id } : {}),
    ...(projectId ? { beneficiary: { projectId } } : {}),
  };

  const pendingRechecks = await prisma.serviceDelivery.findMany({
    where: {
      ...deliveryWhere,
      recheckDueDate: { gte: now },
    },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          steps: { orderBy: { stepOrder: "asc" }, select: { id: true, stepOrder: true, name: true, description: true } },
        },
      },
      beneficiary: {
        select: {
          id: true,
          name: true,
          beneficiaryCode: true,
          mobile: true,
          isUrgentCase: true,
        },
      },
      currentStep: true,
      stepProgress: {
        orderBy: { completedAt: "asc" },
        include: { completedBy: { select: { id: true, name: true } } },
      },
      enteredBy: { select: { id: true, name: true } },
    },
    orderBy: [{ recheckDueDate: "asc" }, { createdAt: "asc" }],
  });

  const overdueRechecks = await prisma.serviceDelivery.findMany({
    where: {
      ...deliveryWhere,
      recheckDueDate: { lt: now },
    },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          steps: { orderBy: { stepOrder: "asc" }, select: { id: true, stepOrder: true, name: true, description: true } },
        },
      },
      currentStep: true,
      stepProgress: {
        orderBy: { completedAt: "asc" },
        include: { completedBy: { select: { id: true, name: true } } },
      },
      beneficiary: {
        select: {
          id: true,
          name: true,
          beneficiaryCode: true,
          mobile: true,
          isUrgentCase: true,
        },
      },
      enteredBy: { select: { id: true, name: true } },
    },
    orderBy: { recheckDueDate: "asc" },
  });

  const serialize = (d: (typeof pendingRechecks)[0]) => ({
    ...d,
    recheckDueDate: d.recheckDueDate.toISOString(),
    recheckedAt: d.recheckedAt?.toISOString() ?? null,
    objectionRaisedAt: d.objectionRaisedAt?.toISOString() ?? null,
    objectionClearedAt: d.objectionClearedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    stepProgress: d.stepProgress.map((p) => ({
      ...p,
      completedAt: p.completedAt.toISOString(),
    })),
  });

  return NextResponse.json({
    pending: pendingRechecks.map(serialize),
    overdue: overdueRechecks.map(serialize),
  });
}
