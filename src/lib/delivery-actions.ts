import { prisma } from "@/lib/prisma";
import { ServiceDeliveryStatus } from "@/generated/prisma/enums";
import { ensureContributionForDelivery } from "@/lib/community-contribution";

const deliveryInclude = {
  service: {
    select: {
      id: true,
      name: true,
      steps: { orderBy: { stepOrder: "asc" as const } },
    },
  },
  currentStep: true,
  stepProgress: {
    orderBy: { completedAt: "asc" as const },
    include: {
      completedBy: { select: { id: true, name: true } },
      step: { select: { id: true, stepOrder: true, name: true } },
    },
  },
  beneficiary: { select: { id: true, name: true, beneficiaryCode: true } },
  enteredBy: { select: { id: true, name: true } },
  recheckedBy: { select: { id: true, name: true } },
  objectionRaisedBy: { select: { id: true, name: true } },
  objectionClearedBy: { select: { id: true, name: true } },
};

export async function fetchDeliveryWithProgress(id: string) {
  return prisma.serviceDelivery.findUnique({
    where: { id },
    include: deliveryInclude,
  });
}

export async function approveDelivery(deliveryId: string, userId: string) {
  const existing = await fetchDeliveryWithProgress(deliveryId);
  if (!existing) throw new Error("Delivery not found");
  if (existing.status !== "DATA_ENTERED") {
    throw new Error("Only data-entered records can be approved");
  }

  const steps = existing.service?.steps ?? [];
  const now = new Date();

  if (steps.length === 0) {
    const updated = await prisma.serviceDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "COMPLETED",
        recheckedAt: now,
        recheckedById: userId,
      },
      include: deliveryInclude,
    });
    await ensureContributionForDelivery(deliveryId, userId);
    return updated;
  }

  return prisma.serviceDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "IN_PROGRESS",
      currentStepId: steps[0].id,
      recheckedAt: now,
      recheckedById: userId,
      objectionActive: false,
    },
    include: deliveryInclude,
  });
}

export async function advanceDeliveryStep(
  deliveryId: string,
  userId: string,
  notes?: string
) {
  const existing = await fetchDeliveryWithProgress(deliveryId);
  if (!existing) throw new Error("Delivery not found");
  if (existing.objectionActive) {
    throw new Error("Clear the objection before advancing to the next step");
  }
  if (existing.status !== "IN_PROGRESS" || !existing.currentStepId) {
    throw new Error("No active step to complete");
  }

  const steps = existing.service?.steps ?? [];
  const currentIndex = steps.findIndex((s) => s.id === existing.currentStepId);
  if (currentIndex < 0) throw new Error("Current step not found");

  await prisma.deliveryStepProgress.upsert({
    where: {
      deliveryId_stepId: {
        deliveryId,
        stepId: existing.currentStepId,
      },
    },
    create: {
      deliveryId,
      stepId: existing.currentStepId,
      completedById: userId,
      notes,
    },
    update: {
      completedById: userId,
      completedAt: new Date(),
      notes,
    },
  });

  const nextStep = steps[currentIndex + 1];
  if (nextStep) {
    return prisma.serviceDelivery.update({
      where: { id: deliveryId },
      data: { currentStepId: nextStep.id },
      include: deliveryInclude,
    });
  }

  const updated = await prisma.serviceDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "COMPLETED",
      currentStepId: null,
    },
    include: deliveryInclude,
  });
  await ensureContributionForDelivery(deliveryId, userId);
  return updated;
}

export async function raiseDeliveryObjection(
  deliveryId: string,
  userId: string,
  note: string
) {
  const existing = await fetchDeliveryWithProgress(deliveryId);
  if (!existing) throw new Error("Delivery not found");
  if (existing.status === "COMPLETED" || existing.status === "REJECTED") {
    throw new Error("Cannot raise objection on a closed delivery");
  }

  const steps = existing.service?.steps ?? [];
  const needsStep =
    existing.status === "IN_PROGRESS" && !existing.currentStepId && steps.length > 0;

  return prisma.serviceDelivery.update({
    where: { id: deliveryId },
    data: {
      objectionActive: true,
      objectionNote: note,
      objectionRaisedAt: new Date(),
      objectionRaisedById: userId,
      objectionClearedAt: null,
      objectionClearedById: null,
      ...(needsStep ? { currentStepId: steps[0].id } : {}),
    },
    include: deliveryInclude,
  });
}

export async function clearDeliveryObjection(
  deliveryId: string,
  userId: string,
  resolutionNote?: string
) {
  const existing = await fetchDeliveryWithProgress(deliveryId);
  if (!existing) throw new Error("Delivery not found");
  if (!existing.objectionActive) throw new Error("No active objection to clear");

  return prisma.serviceDelivery.update({
    where: { id: deliveryId },
    data: {
      objectionActive: false,
      objectionClearedAt: new Date(),
      objectionClearedById: userId,
      notes: resolutionNote
        ? [existing.notes, `Objection cleared: ${resolutionNote}`].filter(Boolean).join("\n")
        : existing.notes,
    },
    include: deliveryInclude,
  });
}

export async function rejectDelivery(
  deliveryId: string,
  userId: string,
  notes?: string
) {
  const existing = await fetchDeliveryWithProgress(deliveryId);
  if (!existing) throw new Error("Delivery not found");

  const isRecheck = existing.status === "DATA_ENTERED";

  return prisma.serviceDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "REJECTED",
      currentStepId: null,
      objectionActive: false,
      notes: notes ?? existing.notes,
      ...(isRecheck ? { recheckedAt: new Date(), recheckedById: userId } : {}),
    },
    include: deliveryInclude,
  });
}

export async function setLegacyDeliveryStatus(
  deliveryId: string,
  userId: string,
  status: ServiceDeliveryStatus,
  notes?: string
) {
  const existing = await fetchDeliveryWithProgress(deliveryId);
  if (!existing) throw new Error("Delivery not found");

  const isRecheck =
    status !== "DATA_ENTERED" && existing.status === "DATA_ENTERED";

  let currentStepId = existing.currentStepId;
  if (status === "IN_PROGRESS" && !currentStepId) {
    const steps = existing.service?.steps ?? [];
    currentStepId = steps[0]?.id ?? null;
  }
  if (status === "COMPLETED" || status === "REJECTED") {
    currentStepId = null;
  }

  const updated = await prisma.serviceDelivery.update({
    where: { id: deliveryId },
    data: {
      status,
      notes: notes ?? existing.notes,
      currentStepId,
      ...(isRecheck ? { recheckedAt: new Date(), recheckedById: userId } : {}),
      ...(status === "COMPLETED" || status === "REJECTED"
        ? { objectionActive: false }
        : {}),
    },
    include: deliveryInclude,
  });

  if (status === "COMPLETED") {
    await ensureContributionForDelivery(deliveryId, userId);
  }

  return updated;
}

export function serializeDelivery(d: NonNullable<Awaited<ReturnType<typeof fetchDeliveryWithProgress>>>) {
  return {
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
  };
}
