import { PrismaClient } from "@/generated/prisma/client";
import { ensureAccountingSetup } from "@/lib/accounting";
import {
  getProfitAndLoss,
  getFundWiseStatement,
  getTrialBalance,
} from "@/lib/financial-reports";
import { getMilestoneBudgetVsActual } from "@/lib/ngo-finance-workflow";

export async function buildBoardAuditPack(prisma: PrismaClient, quarterLabel?: string) {
  await ensureAccountingSetup(prisma);

  const now = new Date();
  const q = quarterLabel ?? `Q${Math.floor(now.getMonth() / 3) + 1}-${now.getFullYear()}`;
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 3, 1));
  if (now < yearStart) yearStart.setUTCFullYear(yearStart.getUTCFullYear() - 1);

  const [pl, fundWise, trialBalance, milestones, safeguarding, compliance] = await Promise.all([
    getProfitAndLoss(prisma, yearStart, now),
    getFundWiseStatement(prisma, yearStart, now),
    getTrialBalance(prisma),
    getMilestoneBudgetVsActual(prisma),
    prisma.safeguardingIncident.findMany({
      where: { createdAt: { gte: yearStart } },
      select: { id: true, title: true, severity: true, status: true, notifyBoard: true },
    }),
    prisma.complianceItem.findMany({
      where: { status: { in: ["DUE", "OVERDUE", "UPCOMING"] } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  const openRisks = milestones.filter((m) => m.utilizationPercent > 90 || m.achievementPct < 50);

  const settings = await prisma.orgSettings.findUnique({ where: { id: "default" } });

  return {
    packType: "BOARD-AUDIT",
    period: q,
    generatedAt: now.toISOString(),
    organization: settings?.orgName ?? "Organization",
    financialSummary: {
      income: pl.totalIncome,
      expenses: pl.totalExpense,
      surplus: pl.surplus,
    },
    fundBalances: fundWise.map((f) => ({
      code: f.fundCode,
      name: f.fundName,
      net: f.net,
      isFcra: f.isFcra,
    })),
    trialBalanceHighlights: trialBalance
      .filter((r) => Math.abs(r.balance) > 10000)
      .slice(0, 15)
      .map((r) => ({ code: r.accountCode, name: r.accountName, balance: r.balance })),
    programDelivery: {
      milestoneCount: milestones.length,
      atRisk: openRisks.length,
      milestones: milestones.slice(0, 20),
    },
    safeguarding: {
      totalIncidents: safeguarding.length,
      open: safeguarding.filter((s) => s.status === "OPEN" || s.status === "INVESTIGATING").length,
      boardNotified: safeguarding.filter((s) => s.notifyBoard).length,
      incidents: safeguarding,
    },
    complianceDeadlines: compliance.map((c) => ({
      type: c.type,
      title: c.title,
      dueDate: c.dueDate.toISOString().slice(0, 10),
      status: c.status,
    })),
  };
}
