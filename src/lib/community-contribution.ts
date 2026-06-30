import { Prisma } from "@/generated/prisma/client";
import {
  CommunityContributionCollectionStatus,
  CommunityContributionRecipientType,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/beneficiary-utils";
import type { SetupCatalogItem } from "@/lib/projects";

export type ContributionCollectionStatus = CommunityContributionCollectionStatus;

export const CONTRIBUTION_COLLECTION_LABELS: Record<ContributionCollectionStatus, string> = {
  COLLECTED: "Collected",
  PENDING: "Pending",
};

export const CONTRIBUTION_RECIPIENT_LABELS: Record<CommunityContributionRecipientType, string> = {
  NGO: "NGO (direct)",
  PARTNER: "Partner / SHG",
};

/** Shown near data-entry fields — avoids “profit” or “fee” wording. */
export const COMMUNITY_CONTRIBUTION_FIELD_HINT =
  "Community contribution — amount paid by the beneficiary toward the service (not NGO profit).";

export function formatContributionInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface CommunityContributionRuleDto {
  id: string;
  projectId: string;
  serviceId: string;
  serviceName?: string;
  amountPerBeneficiary: number;
  recipientType: CommunityContributionRecipientType;
  partnerId: string | null;
  partnerName: string | null;
  isActive: boolean;
}

export function serializeContributionRule(
  rule: Prisma.CommunityContributionRuleGetPayload<{ include: { service: { select: { name: true } } } }>
): CommunityContributionRuleDto {
  return {
    id: rule.id,
    projectId: rule.projectId,
    serviceId: rule.serviceId,
    serviceName: rule.service.name,
    amountPerBeneficiary: decimalToNumber(rule.amountPerBeneficiary) ?? 0,
    recipientType: rule.recipientType,
    partnerId: rule.partnerId,
    partnerName: rule.partnerName,
    isActive: rule.isActive,
  };
}

export async function findContributionRule(projectId: string, serviceId: string) {
  return prisma.communityContributionRule.findFirst({
    where: { projectId, serviceId, isActive: true },
    include: { service: { select: { name: true } }, partner: { select: { name: true } } },
  });
}

export interface CreateContributionInput {
  projectId: string;
  beneficiaryId: string;
  serviceDeliveryId: string;
  serviceId: string;
  enteredById: string;
  collectionStatus?: ContributionCollectionStatus;
}

/** Create a ledger row when a service is registered, if a rule exists for this project+service. */
export async function createContributionForDelivery(input: CreateContributionInput) {
  const rule = await findContributionRule(input.projectId, input.serviceId);
  if (!rule) return null;

  const amount = decimalToNumber(rule.amountPerBeneficiary) ?? 0;
  if (amount <= 0) return null;

  const status = input.collectionStatus ?? "PENDING";
  const partnerName = rule.partnerName ?? rule.partner?.name ?? null;

  return prisma.communityContributionEntry.create({
    data: {
      projectId: input.projectId,
      beneficiaryId: input.beneficiaryId,
      serviceDeliveryId: input.serviceDeliveryId,
      serviceId: input.serviceId,
      amount,
      collectionStatus: status,
      recipientType: rule.recipientType,
      partnerId: rule.partnerId,
      partnerName,
      collectedAt: status === "COLLECTED" ? new Date() : null,
      enteredById: input.enteredById,
    },
  });
}

/** Create entry on delivery completion if missing (legacy deliveries without entry). */
export async function ensureContributionForDelivery(
  deliveryId: string,
  enteredById: string,
  collectionStatus: ContributionCollectionStatus = "PENDING"
) {
  const existing = await prisma.communityContributionEntry.findUnique({
    where: { serviceDeliveryId: deliveryId },
  });
  if (existing) return existing;

  const delivery = await prisma.serviceDelivery.findUnique({
    where: { id: deliveryId },
    include: { beneficiary: { select: { projectId: true } } },
  });
  if (!delivery?.serviceId || !delivery.beneficiary.projectId) return null;

  return createContributionForDelivery({
    projectId: delivery.beneficiary.projectId,
    beneficiaryId: delivery.beneficiaryId,
    serviceDeliveryId: delivery.id,
    serviceId: delivery.serviceId,
    enteredById,
    collectionStatus,
  });
}

export async function updateContributionCollectionStatus(
  entryId: string,
  status: ContributionCollectionStatus
) {
  return prisma.communityContributionEntry.update({
    where: { id: entryId },
    data: {
      collectionStatus: status,
      collectedAt: status === "COLLECTED" ? new Date() : null,
    },
  });
}

export function serializeContributionEntry(
  entry: Prisma.CommunityContributionEntryGetPayload<{
    include: { service: { select: { name: true } } };
  }>
) {
  return {
    id: entry.id,
    projectId: entry.projectId,
    beneficiaryId: entry.beneficiaryId,
    serviceDeliveryId: entry.serviceDeliveryId,
    serviceId: entry.serviceId,
    serviceName: entry.service.name,
    amount: decimalToNumber(entry.amount) ?? 0,
    collectionStatus: entry.collectionStatus,
    recipientType: entry.recipientType,
    partnerId: entry.partnerId,
    partnerName: entry.partnerName,
    collectedAt: entry.collectedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}

/** Push catalog contribution settings to database rules (project setup → portal). */
export async function syncCatalogContributionRules(
  projectId: string,
  catalog: SetupCatalogItem[]
): Promise<void> {
  for (const item of catalog) {
    if (!item.linkedServiceId || !item.communityContributionAmount) continue;
    await prisma.communityContributionRule.upsert({
      where: {
        projectId_serviceId: { projectId, serviceId: item.linkedServiceId },
      },
      create: {
        projectId,
        serviceId: item.linkedServiceId,
        amountPerBeneficiary: item.communityContributionAmount,
        recipientType: item.communityContributionRecipientType ?? "NGO",
        partnerName: item.communityContributionPartnerName ?? null,
        isActive: true,
      },
      update: {
        amountPerBeneficiary: item.communityContributionAmount,
        recipientType: item.communityContributionRecipientType ?? "NGO",
        partnerName: item.communityContributionPartnerName ?? null,
        isActive: true,
      },
    });
  }
}

export interface PeriodContributionSummary {
  collectedCount: number;
  collectedAmount: number;
  pendingCount: number;
  pendingAmount: number;
  totalEntries: number;
  byService: Array<{
    serviceId: string;
    serviceName: string;
    collectedAmount: number;
    pendingAmount: number;
  }>;
  byRecipient: Array<{
    recipientType: CommunityContributionRecipientType;
    partnerName: string | null;
    collectedAmount: number;
    pendingAmount: number;
  }>;
  byMonth: Array<{ month: string; collected: number; pending: number }>;
}

export async function buildPeriodContributionSummary(options: {
  projectId?: string;
  from?: Date;
  to?: Date;
}): Promise<PeriodContributionSummary> {
  const where: Prisma.CommunityContributionEntryWhereInput = {};
  if (options.projectId) where.projectId = options.projectId;
  if (options.from || options.to) {
    where.createdAt = {};
    if (options.from) where.createdAt.gte = options.from;
    if (options.to) where.createdAt.lte = options.to;
  }

  const entries = await prisma.communityContributionEntry.findMany({
    where,
    include: { service: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  let collectedCount = 0;
  let collectedAmount = 0;
  let pendingCount = 0;
  let pendingAmount = 0;
  const serviceMap = new Map<string, { serviceName: string; collectedAmount: number; pendingAmount: number }>();
  const recipientMap = new Map<
    string,
    {
      recipientType: CommunityContributionRecipientType;
      partnerName: string | null;
      collectedAmount: number;
      pendingAmount: number;
    }
  >();
  const monthMap = new Map<string, { collected: number; pending: number }>();

  for (const entry of entries) {
    const amount = decimalToNumber(entry.amount) ?? 0;
    const isCollected = entry.collectionStatus === "COLLECTED";
    const month = entry.createdAt.toISOString().slice(0, 7);

    if (isCollected) {
      collectedCount += 1;
      collectedAmount += amount;
    } else {
      pendingCount += 1;
      pendingAmount += amount;
    }

    const svc = serviceMap.get(entry.serviceId) ?? {
      serviceName: entry.service.name,
      collectedAmount: 0,
      pendingAmount: 0,
    };
    if (isCollected) svc.collectedAmount += amount;
    else svc.pendingAmount += amount;
    serviceMap.set(entry.serviceId, svc);

    const recipientKey = `${entry.recipientType}:${entry.partnerName ?? ""}`;
    const rec = recipientMap.get(recipientKey) ?? {
      recipientType: entry.recipientType,
      partnerName: entry.partnerName,
      collectedAmount: 0,
      pendingAmount: 0,
    };
    if (isCollected) rec.collectedAmount += amount;
    else rec.pendingAmount += amount;
    recipientMap.set(recipientKey, rec);

    const mo = monthMap.get(month) ?? { collected: 0, pending: 0 };
    if (isCollected) mo.collected += amount;
    else mo.pending += amount;
    monthMap.set(month, mo);
  }

  return {
    collectedCount,
    collectedAmount,
    pendingCount,
    pendingAmount,
    totalEntries: entries.length,
    byService: [...serviceMap.entries()].map(([serviceId, row]) => ({ serviceId, ...row })),
    byRecipient: [...recipientMap.values()],
    byMonth: [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, row]) => ({ month, ...row })),
  };
}

function dayBounds(dateKey: string): { start: Date; end: Date } {
  const start = new Date(`${dateKey}T00:00:00.000`);
  const end = new Date(`${dateKey}T23:59:59.999`);
  return { start, end };
}

export interface DailyContributionSummary {
  date: string;
  projectId: string | null;
  collectedCount: number;
  collectedAmount: number;
  pendingCount: number;
  pendingAmount: number;
  totalEntries: number;
  byService: Array<{
    serviceId: string;
    serviceName: string;
    collectedCount: number;
    collectedAmount: number;
    pendingCount: number;
    pendingAmount: number;
  }>;
  byRecipient: Array<{
    recipientType: CommunityContributionRecipientType;
    partnerName: string | null;
    collectedAmount: number;
    pendingAmount: number;
  }>;
}

export async function buildDailyContributionSummary(options: {
  dateKey: string;
  projectId?: string;
  enteredById?: string;
}): Promise<DailyContributionSummary> {
  const { start, end } = dayBounds(options.dateKey);

  const where: Prisma.CommunityContributionEntryWhereInput = {
    createdAt: { gte: start, lte: end },
  };
  if (options.projectId) where.projectId = options.projectId;
  if (options.enteredById) where.enteredById = options.enteredById;

  const entries = await prisma.communityContributionEntry.findMany({
    where,
    include: { service: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  let collectedCount = 0;
  let collectedAmount = 0;
  let pendingCount = 0;
  let pendingAmount = 0;

  const serviceMap = new Map<
    string,
    {
      serviceName: string;
      collectedCount: number;
      collectedAmount: number;
      pendingCount: number;
      pendingAmount: number;
    }
  >();

  const recipientMap = new Map<
    string,
    {
      recipientType: CommunityContributionRecipientType;
      partnerName: string | null;
      collectedAmount: number;
      pendingAmount: number;
    }
  >();

  for (const entry of entries) {
    const amount = decimalToNumber(entry.amount) ?? 0;
    const isCollected = entry.collectionStatus === "COLLECTED";

    if (isCollected) {
      collectedCount += 1;
      collectedAmount += amount;
    } else {
      pendingCount += 1;
      pendingAmount += amount;
    }

    const svc = serviceMap.get(entry.serviceId) ?? {
      serviceName: entry.service.name,
      collectedCount: 0,
      collectedAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
    };
    if (isCollected) {
      svc.collectedCount += 1;
      svc.collectedAmount += amount;
    } else {
      svc.pendingCount += 1;
      svc.pendingAmount += amount;
    }
    serviceMap.set(entry.serviceId, svc);

    const recipientKey = `${entry.recipientType}:${entry.partnerName ?? ""}`;
    const rec = recipientMap.get(recipientKey) ?? {
      recipientType: entry.recipientType,
      partnerName: entry.partnerName,
      collectedAmount: 0,
      pendingAmount: 0,
    };
    if (isCollected) rec.collectedAmount += amount;
    else rec.pendingAmount += amount;
    recipientMap.set(recipientKey, rec);
  }

  return {
    date: options.dateKey,
    projectId: options.projectId ?? null,
    collectedCount,
    collectedAmount,
    pendingCount,
    pendingAmount,
    totalEntries: entries.length,
    byService: [...serviceMap.entries()].map(([serviceId, row]) => ({
      serviceId,
      ...row,
    })),
    byRecipient: [...recipientMap.values()],
  };
}
