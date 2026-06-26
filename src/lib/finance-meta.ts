import { PrismaClient } from "@/generated/prisma/client";

/** Map legacy fundType strings to Fund.code in the ledger. */
export const FUND_TYPE_TO_CODE: Record<string, string> = {
  CSR: "CSR",
  FCRA: "FCRA",
  RESTRICTED: "CSR",
  GOVERNMENT: "GOV",
  GOV: "GOV",
  GENERAL: "UNR",
  UNRESTRICTED: "UNR",
  DONATION: "UNR",
};

export async function resolveFundId(
  prisma: PrismaClient,
  opts: { fundId?: string | null; fundType?: string | null }
): Promise<string | null> {
  if (opts.fundId) return opts.fundId;
  if (!opts.fundType?.trim()) return null;
  const code = FUND_TYPE_TO_CODE[opts.fundType.toUpperCase()] ?? opts.fundType.toUpperCase();
  const fund = await prisma.fund.findUnique({ where: { code } });
  return fund?.id ?? null;
}

export async function resolveFinanceProjectId(
  prisma: PrismaClient,
  opts: { financeProjectId?: string | null; projectId?: string | null }
): Promise<string | null> {
  if (opts.financeProjectId) return opts.financeProjectId;
  if (!opts.projectId) return null;
  const linked = await prisma.financeProject.findFirst({
    where: { OR: [{ legacyProjectId: opts.projectId }, { id: opts.projectId }] },
  });
  return linked?.id ?? null;
}

export async function checkBudgetEncumbrance(
  prisma: PrismaClient,
  opts: {
    financeProjectId: string | null;
    budgetHead?: string | null;
    amount: number;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!opts.financeProjectId || !opts.budgetHead) return { ok: true };

  const line = await prisma.projectBudgetLine.findFirst({
    where: { financeProjectId: opts.financeProjectId, budgetHead: opts.budgetHead },
  });
  if (!line) return { ok: true };

  const budget = Number(line.amount);
  const approved = await prisma.expense.aggregate({
    where: {
      financeProjectId: opts.financeProjectId,
      budgetHead: opts.budgetHead,
      status: "APPROVED",
    },
    _sum: { amount: true },
  });
  const pending = await prisma.expense.aggregate({
    where: {
      financeProjectId: opts.financeProjectId,
      budgetHead: opts.budgetHead,
      status: "PENDING",
    },
    _sum: { amount: true },
  });
  const committed =
    Number(approved._sum.amount ?? 0) + Number(pending._sum.amount ?? 0) + opts.amount;
  if (committed > budget) {
    return {
      ok: false,
      message: `Budget exceeded for "${opts.budgetHead}": committed ₹${committed.toFixed(2)} vs budget ₹${budget.toFixed(2)}`,
    };
  }
  return { ok: true };
}

export function getIndianFYOptions(count = 3): string[] {
  const now = new Date();
  const month = now.getMonth();
  const startYear = month >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: count }, (_, i) => {
    const y = startYear - i;
    return `${y}-${String(y + 1).slice(-2)}`;
  });
}
