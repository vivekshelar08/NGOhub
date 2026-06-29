import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PartnerUcStatus, SubGrantStatus } from "@/generated/prisma/enums";

type Db = PrismaClient | Prisma.TransactionClient;

export interface CreateSubGrantInput {
  partnerId: string;
  financeProjectId: string;
  amount: number;
  adminPercent?: number;
  startDate: Date;
  endDate: Date;
  notes?: string;
  userId: string;
}

export async function createSubGrantAgreement(prisma: Db, input: CreateSubGrantInput) {
  const agreementNumber = `SG-${Date.now().toString(36).toUpperCase()}`;
  return prisma.subGrantAgreement.create({
    data: {
      partnerId: input.partnerId,
      financeProjectId: input.financeProjectId,
      agreementNumber,
      amount: input.amount,
      adminPercent: input.adminPercent ?? 0,
      startDate: input.startDate,
      endDate: input.endDate,
      notes: input.notes,
      status: SubGrantStatus.ACTIVE,
      createdById: input.userId,
    },
    include: {
      partner: true,
      financeProject: { select: { id: true, code: true, name: true } },
    },
  });
}

export async function submitPartnerUc(
  prisma: Db,
  subGrantId: string,
  periodStart: Date,
  periodEnd: Date,
  amount: number,
  notes?: string
) {
  return prisma.partnerUcSubmission.create({
    data: {
      subGrantId,
      periodStart,
      periodEnd,
      amount,
      notes,
      status: PartnerUcStatus.SUBMITTED,
      submittedAt: new Date(),
    },
  });
}

export async function approvePartnerUc(prisma: Db, ucId: string, reviewerId: string) {
  return prisma.partnerUcSubmission.update({
    where: { id: ucId },
    data: {
      status: PartnerUcStatus.APPROVED,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });
}

/** Roll up approved partner UCs into prime donor UC total. */
export async function rollupPartnerUcsForProject(prisma: Db, financeProjectId: string) {
  const subGrants = await prisma.subGrantAgreement.findMany({
    where: { financeProjectId, status: SubGrantStatus.ACTIVE },
    include: {
      partnerUcs: { where: { status: PartnerUcStatus.APPROVED } },
      partner: { select: { name: true } },
    },
  });

  const rows = subGrants.map((sg) => ({
    partnerName: sg.partner.name,
    agreementNumber: sg.agreementNumber,
    totalGranted: Number(sg.amount),
    adminPercent: Number(sg.adminPercent),
    approvedUcTotal: sg.partnerUcs.reduce((s, u) => s + Number(u.amount), 0),
    ucs: sg.partnerUcs.map((u) => ({
      id: u.id,
      periodStart: u.periodStart,
      periodEnd: u.periodEnd,
      amount: Number(u.amount),
    })),
  }));

  const grandTotal = rows.reduce((s, r) => s + r.approvedUcTotal, 0);
  return { financeProjectId, rows, grandTotal };
}

export async function listSubGrants(prisma: Db, financeProjectId?: string) {
  return prisma.subGrantAgreement.findMany({
    where: financeProjectId ? { financeProjectId } : undefined,
    include: {
      partner: true,
      financeProject: { select: { id: true, code: true, name: true } },
      partnerUcs: { orderBy: { periodEnd: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}
