import { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  DonorPipelineStage,
  GrantAgreementStatus,
  GrantTrancheStatus,
} from "@/generated/prisma/enums";

type Db = PrismaClient | Prisma.TransactionClient;

export interface CreateGrantAgreementInput {
  financeProjectId: string;
  donorId?: string;
  donorName: string;
  totalAmount: number;
  startDate: Date;
  endDate: Date;
  restriction?: "UNRESTRICTED" | "RESTRICTED" | "DESIGNATED";
  reportingCadence?: string;
  tranches: Array<{
    amount: number;
    dueDate: Date;
    reportDueDate?: Date;
    milestoneBudgetId?: string;
  }>;
  pipelineEntryId?: string;
  userId: string;
}

export async function createGrantAgreement(prisma: Db, input: CreateGrantAgreementInput) {
  const agreementNumber = `GA-${Date.now().toString(36).toUpperCase()}`;
  const agreement = await prisma.grantAgreement.create({
    data: {
      financeProjectId: input.financeProjectId,
      donorId: input.donorId,
      donorName: input.donorName,
      agreementNumber,
      totalAmount: input.totalAmount,
      startDate: input.startDate,
      endDate: input.endDate,
      restriction: input.restriction ?? "RESTRICTED",
      reportingCadence: input.reportingCadence,
      pipelineEntryId: input.pipelineEntryId,
      status: GrantAgreementStatus.ACTIVE,
      createdById: input.userId,
      tranches: {
        create: input.tranches.map((t, i) => ({
          sequence: i + 1,
          amount: t.amount,
          dueDate: t.dueDate,
          reportDueDate: t.reportDueDate,
          milestoneBudgetId: t.milestoneBudgetId,
          status: GrantTrancheStatus.PLANNED,
        })),
      },
    },
    include: { tranches: true, financeProject: true },
  });

  if (input.pipelineEntryId) {
    await prisma.donorPipelineEntry.update({
      where: { id: input.pipelineEntryId },
      data: { stage: DonorPipelineStage.GRANTED, grantedAt: new Date() },
    });
  }

  return agreement;
}

export async function listGrantAgreements(prisma: Db, financeProjectId?: string) {
  return prisma.grantAgreement.findMany({
    where: financeProjectId ? { financeProjectId } : undefined,
    include: {
      tranches: { orderBy: { sequence: "asc" } },
      financeProject: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDueTrancheReminders(prisma: Db, withinDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  const tranches = await prisma.grantTranche.findMany({
    where: {
      dueDate: { lte: cutoff },
      status: { in: [GrantTrancheStatus.PLANNED, GrantTrancheStatus.DUE] },
    },
    include: {
      agreement: {
        include: { financeProject: { select: { code: true, name: true } } },
      },
    },
    orderBy: { dueDate: "asc" },
  });
  return tranches;
}

export async function activateGrantAgreement(prisma: Db, agreementId: string) {
  return prisma.grantAgreement.update({
    where: { id: agreementId },
    data: { status: GrantAgreementStatus.ACTIVE },
  });
}

/** When donor pipeline moves to GRANTED, create grant agreement + tranche schedule. */
export async function createGrantAgreementFromPipelineEntry(
  prisma: PrismaClient,
  entry: {
    id: string;
    donorId: string;
    donorName: string;
    projectId: string | null;
    amountPledged: { toString(): string } | null;
    reportDueDate: Date | null;
  },
  userId: string
) {
  if (!entry.projectId) {
    throw new Error("Link a project to this pipeline entry before marking GRANTED");
  }
  const amount = entry.amountPledged ? Number(entry.amountPledged) : 0;
  if (amount <= 0) {
    throw new Error("Set a pledged amount before marking GRANTED");
  }

  const existing = await prisma.grantAgreement.findFirst({
    where: { pipelineEntryId: entry.id },
  });
  if (existing) return { agreement: existing, created: false };

  const fp = await prisma.financeProject.findFirst({
    where: { legacyProjectId: entry.projectId },
  });
  if (!fp) {
    throw new Error("No finance project found — approve the program project first to sync finance");
  }

  const start = fp.startDate ?? new Date();
  const end = fp.endDate ?? new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const agreement = await createGrantAgreement(prisma, {
    financeProjectId: fp.id,
    donorId: entry.donorId,
    donorName: entry.donorName,
    totalAmount: amount,
    startDate: start,
    endDate: end,
    pipelineEntryId: entry.id,
    userId,
    reportingCadence: "Quarterly",
    tranches: [
      {
        amount,
        dueDate,
        reportDueDate: entry.reportDueDate ?? undefined,
      },
    ],
  });

  await prisma.financeProject.update({
    where: { id: fp.id },
    data: { donorId: entry.donorId, donorName: entry.donorName },
  });

  return { agreement, created: true };
}
