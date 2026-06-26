import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ensureAccountingSetup } from "@/lib/accounting";
import { getTrialBalance, getProfitAndLoss, getFundWiseStatement } from "@/lib/financial-reports";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "view_board_portal")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureAccountingSetup(prisma);

  const [trialBalance, profitLoss, fundWise] = await Promise.all([
    getTrialBalance(prisma),
    getProfitAndLoss(prisma),
    getFundWiseStatement(prisma),
  ]);

  const totalAssets = trialBalance
    .filter((r) => r.category === "ASSET")
    .reduce((s, r) => s + r.balance, 0);
  const totalLiabilities = trialBalance
    .filter((r) => r.category === "LIABILITY")
    .reduce((s, r) => s + Math.abs(r.balance), 0);

  return NextResponse.json({
    summary: {
      totalAssets,
      totalLiabilities,
      netSurplus: profitLoss.surplus,
      income: profitLoss.totalIncome,
      expenses: profitLoss.totalExpense,
    },
    fundWise: fundWise.map((f) => ({
      code: f.fundCode,
      name: f.fundName,
      income: f.income,
      expenses: f.expense,
      balance: f.net,
    })),
  });
}
