import { PrismaClient } from "@/generated/prisma/client";

export async function getPublicImpactData(prisma: PrismaClient, legacyProjectId: string) {
  const fp = await prisma.financeProject.findFirst({
    where: { legacyProjectId },
    include: { publicPage: true, milestoneBudgets: true },
  });
  if (!fp?.publicPage?.isPublished) return null;

  const beneficiaryCount = fp.publicPage.showBeneficiaries
    ? await prisma.beneficiary.count({
        where: { projectId: legacyProjectId, isRemoved: false },
      })
    : null;

  const totalSpent = await prisma.expense.aggregate({
    where: { financeProjectId: fp.id, status: "APPROVED" },
    _sum: { amount: true },
  });

  return {
    projectId: legacyProjectId,
    projectName: fp.name,
    summary: fp.publicPage.summary,
    sdgTags: fp.publicPage.sdgTags,
    publishedAt: fp.publicPage.publishedAt?.toISOString() ?? null,
    budget: fp.publicPage.showBudget
      ? {
          total: fp.totalBudget ? Number(fp.totalBudget) : null,
          spent: Number(totalSpent._sum.amount ?? 0),
        }
      : null,
    beneficiariesReached: beneficiaryCount,
    milestones: fp.milestoneBudgets.map((m) => ({
      name: m.milestoneName,
      achievementPct: Number(m.achievementPct),
      status: m.status,
    })),
  };
}

export async function upsertPublicProjectPage(
  prisma: PrismaClient,
  financeProjectId: string,
  data: {
    legacyProjectId?: string;
    isPublished?: boolean;
    summary?: string;
    sdgTags?: string[];
    showBudget?: boolean;
    showBeneficiaries?: boolean;
  }
) {
  return prisma.publicProjectPage.upsert({
    where: { financeProjectId },
    create: {
      financeProjectId,
      legacyProjectId: data.legacyProjectId,
      isPublished: data.isPublished ?? false,
      summary: data.summary,
      sdgTags: data.sdgTags ?? [],
      showBudget: data.showBudget ?? true,
      showBeneficiaries: data.showBeneficiaries ?? true,
      publishedAt: data.isPublished ? new Date() : null,
    },
    update: {
      legacyProjectId: data.legacyProjectId,
      isPublished: data.isPublished,
      summary: data.summary,
      sdgTags: data.sdgTags,
      showBudget: data.showBudget,
      showBeneficiaries: data.showBeneficiaries,
      publishedAt: data.isPublished ? new Date() : undefined,
    },
  });
}

export async function listPublishedImpactPages(prisma: PrismaClient) {
  return prisma.publicProjectPage.findMany({
    where: { isPublished: true },
    include: {
      financeProject: { select: { name: true, code: true, legacyProjectId: true } },
    },
  });
}
