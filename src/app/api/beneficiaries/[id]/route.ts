import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import {
  updateBeneficiarySchema,
  addServiceToBeneficiarySchema,
  followUpSchema,
} from "@/lib/validators";
import { decimalToNumber } from "@/lib/beneficiary-utils";
import { computeRecheckDueDate } from "@/lib/service-portal-utils";

type RouteParams = { params: Promise<{ id: string }> };

function serializeBeneficiaryDetail(b: NonNullable<Awaited<ReturnType<typeof fetchBeneficiary>>>) {
  return {
    ...b,
    monthlyIncome: decimalToNumber(b.monthlyIncome),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    deliveries: b.deliveries.map((d) => ({
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
    })),
    followUps: b.followUps.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
    })),
  };
}

async function fetchBeneficiary(id: string) {
  return prisma.beneficiary.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      deliveries: {
        orderBy: { createdAt: "desc" },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              steps: { orderBy: { stepOrder: "asc" } },
            },
          },
          currentStep: true,
          enteredBy: { select: { id: true, name: true } },
          recheckedBy: { select: { id: true, name: true } },
          objectionRaisedBy: { select: { id: true, name: true } },
          stepProgress: {
            orderBy: { completedAt: "asc" },
            include: {
              completedBy: { select: { id: true, name: true } },
              step: { select: { id: true, stepOrder: true, name: true } },
            },
          },
        },
      },
      followUps: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true } },
          delivery: {
            select: { id: true, service: { select: { name: true } } },
          },
        },
      },
    },
  });
}

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.list")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const beneficiary = await fetchBeneficiary(id);
  if (!beneficiary) {
    return NextResponse.json({ error: "Beneficiary not found" }, { status: 404 });
  }

  return NextResponse.json({ beneficiary: serializeBeneficiaryDetail(beneficiary) });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateBeneficiarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = { ...parsed.data } as Record<string, unknown>;
  if (typeof data.removedAt === "string") {
    const raw = String(data.removedAt).trim();
    data.removedAt = raw ? new Date(raw) : null;
  }
  if (typeof data.isRemoved === "boolean" && data.isRemoved && data.removedAt == null) {
    data.removedAt = new Date();
  }
  if (typeof data.isRemoved === "boolean" && !data.isRemoved) {
    data.removedAt = null;
  }

  const beneficiary = await prisma.beneficiary.update({
    where: { id },
    data,
  });

  const full = await fetchBeneficiary(beneficiary.id);
  if (!full) {
    return NextResponse.json({ error: "Beneficiary not found" }, { status: 404 });
  }

  return NextResponse.json({ beneficiary: serializeBeneficiaryDetail(full) });
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const action = body.action as string;

  if (action === "add_service") {
    const parsed = addServiceToBeneficiarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const delivery = await prisma.serviceDelivery.create({
      data: {
        beneficiaryId: id,
        serviceId: parsed.data.serviceId,
        status: "DATA_ENTERED",
        recheckDueDate: computeRecheckDueDate(),
        enteredById: user.id,
        notes: parsed.data.notes,
      },
      include: {
        service: { select: { id: true, name: true } },
        enteredBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      delivery: {
        ...delivery,
        recheckDueDate: delivery.recheckDueDate.toISOString(),
        recheckedAt: delivery.recheckedAt?.toISOString() ?? null,
        createdAt: delivery.createdAt.toISOString(),
        updatedAt: delivery.updatedAt.toISOString(),
      },
    });
  }

  if (action === "follow_up") {
    const parsed = followUpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const followUp = await prisma.beneficiaryFollowUp.create({
      data: {
        beneficiaryId: id,
        deliveryId: parsed.data.deliveryId,
        note: parsed.data.note,
        createdById: user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        delivery: { select: { id: true, service: { select: { name: true } } } },
      },
    });

    return NextResponse.json({
      followUp: { ...followUp, createdAt: followUp.createdAt.toISOString() },
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
