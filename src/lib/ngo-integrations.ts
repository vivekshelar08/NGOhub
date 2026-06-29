import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { MilestoneFinanceStatus } from "@/generated/prisma/enums";
import { syncMilestoneBudgets, type LegacyMilestoneInput } from "@/lib/ngo-finance-workflow";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AutoFinanceProjectInput {
  legacyProjectId: string;
  title: string;
  totalBudget: number;
  donorId?: string;
  donorName?: string;
  fundingType?: string;
  milestones?: LegacyMilestoneInput[];
}

function projectCodeFromLegacy(legacyId: string, title: string): string {
  const slug = title
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();
  return `PRJ-${slug || legacyId.slice(0, 8).toUpperCase()}`;
}

/** Create or link FinanceProject when a program project is approved. */
export async function ensureFinanceProjectForLegacy(
  prisma: Db,
  input: AutoFinanceProjectInput
) {
  const existing = await prisma.financeProject.findFirst({
    where: { legacyProjectId: input.legacyProjectId },
  });
  if (existing) {
    const updated = await prisma.financeProject.update({
      where: { id: existing.id },
      data: {
        name: input.title,
        totalBudget: input.totalBudget,
        donorId: input.donorId,
        donorName: input.donorName,
        fundingType: input.fundingType,
      },
    });
    if (input.milestones?.length) {
      await syncMilestoneBudgets(prisma, updated.id, input.milestones, input.totalBudget);
    }
    return { project: updated, created: false };
  }

  let code = projectCodeFromLegacy(input.legacyProjectId, input.title);
  const clash = await prisma.financeProject.findUnique({ where: { code } });
  if (clash) code = `${code}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

  const project = await prisma.financeProject.create({
    data: {
      code,
      name: input.title,
      legacyProjectId: input.legacyProjectId,
      totalBudget: input.totalBudget,
      donorId: input.donorId,
      donorName: input.donorName,
      fundingType: input.fundingType,
      isActive: true,
    },
  });

  if (input.milestones?.length) {
    await syncMilestoneBudgets(prisma, project.id, input.milestones, input.totalBudget);
  }

  return { project, created: true };
}

/** Update milestone achievement from field activity completion counts. */
export async function syncMilestoneFromFieldActivity(
  prisma: Db,
  legacyProjectId: string,
  legacyMilestoneId: string,
  delta: { activities?: number; beneficiaries?: number }
) {
  const fp = await prisma.financeProject.findFirst({ where: { legacyProjectId } });
  if (!fp) return null;

  const mb = await prisma.projectMilestoneBudget.findUnique({
    where: {
      financeProjectId_legacyMilestoneId: {
        financeProjectId: fp.id,
        legacyMilestoneId,
      },
    },
  });
  if (!mb) return null;

  const achievedActivities = mb.achievedActivities + (delta.activities ?? 0);
  const achievedBeneficiaries = mb.achievedBeneficiaries + (delta.beneficiaries ?? 0);
  const targetTotal = mb.targetActivities + mb.targetBeneficiaries;
  const achievedTotal = achievedActivities + achievedBeneficiaries;
  const achievementPct =
    targetTotal > 0 ? Math.min(100, (achievedTotal / targetTotal) * 100) : mb.achievementPct;

  const achievementPctNum = Number(achievementPct);
  return prisma.projectMilestoneBudget.update({
    where: { id: mb.id },
    data: {
      achievedActivities,
      achievedBeneficiaries,
      achievementPct: achievementPctNum,
      status:
        achievementPctNum >= 100
          ? MilestoneFinanceStatus.ACHIEVED
          : achievementPctNum > 0
            ? MilestoneFinanceStatus.IN_PROGRESS
            : mb.status,
    },
  });
}

/** Bulk sync milestones from legacy project setup. */
export async function syncLegacyProjectToFinance(
  prisma: Db,
  input: AutoFinanceProjectInput
) {
  return ensureFinanceProjectForLegacy(prisma, input);
}
