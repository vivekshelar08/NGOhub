import { Prisma } from "@/generated/prisma/client";
import { CommunityContributionRecipientType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  type CommunityContributionRuleDto,
  type ContributionCollectionStatus,
  type DailyContributionSummary,
  type PeriodContributionSummary,
} from "@/lib/community-contribution-shared";

export type {
  CommunityContributionRuleDto,
  ContributionCollectionStatus,
  DailyContributionSummary,
  PeriodContributionSummary,
} from "@/lib/community-contribution-shared";

export {
  COMMUNITY_CONTRIBUTION_FIELD_HINT,
  CONTRIBUTION_COLLECTION_LABELS,
  CONTRIBUTION_RECIPIENT_LABELS,
  formatContributionInr,
} from "@/lib/community-contribution-shared";

function decimalToNumber(value: unknown): number | null {
  if (value == null) return null;
  return Number(value);
}

export function serializeContributionRule(
  rule: Prisma.CommunityContributionRuleGetPayload<{ include: { service: { select: { name: true } } } }>
): CommunityContributionRuleDto {
  return {
    id: rule.id,
    projectId: rule.projectId,
    serviceId: rule.serviceId,
    serviceName: rule.service.name,
    location: rule.location,
    amountPerBeneficiary: decimalToNumber(rule.amountPerBeneficiary) ?? 0,
    recipientType: rule.recipientType,
    partnerId: rule.partnerId,
    partnerName: rule.partnerName,
    isActive: rule.isActive,
  };
}

export async function findContributionRule(
  projectId: string,
  serviceId: string,
  location?: string
) {
  const normalized = location?.trim() ?? "";
  const specific = await prisma.communityContributionRule.findFirst({
    where: { projectId, serviceId, location: normalized, isActive: true },
    include: { service: { select: { name: true } }, partner: { select: { name: true } } },
  });
  if (specific || normalized === "") return specific;

  return prisma.communityContributionRule.findFirst({
    where: { projectId, serviceId, location: "", isActive: true },
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
  location?: string;
}

export async function createContributionForDelivery(input: CreateContributionInput) {
  let location = input.location?.trim() ?? "";
  if (!location) {
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: input.beneficiaryId },
      select: { location: true },
    });
    location = beneficiary?.location?.trim() ?? "";
  }

  const rule = await findContributionRule(input.projectId, input.serviceId, location);
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
