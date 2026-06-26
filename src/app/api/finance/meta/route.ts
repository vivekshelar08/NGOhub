import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ensureAccountingSetup } from "@/lib/accounting";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureAccountingSetup(prisma);

  const [funds, financeProjects, accounts, bankAccounts] = await Promise.all([
    prisma.fund.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.financeProject.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      include: { budgetLines: true },
    }),
    prisma.ledgerAccount.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, category: true, isSystem: true },
    }),
    prisma.bankAccount.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { ledgerAccount: { select: { code: true, name: true } } },
    }),
  ]);

  return NextResponse.json({
    funds,
    financeProjects: financeProjects.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      fundingType: p.fundingType,
      legacyProjectId: p.legacyProjectId,
      totalBudget: p.totalBudget ? Number(p.totalBudget) : null,
      budgetLines: p.budgetLines.map((b) => ({
        id: b.id,
        budgetHead: b.budgetHead,
        amount: Number(b.amount),
        fundId: b.fundId,
      })),
    })),
    accounts,
    bankAccounts: bankAccounts.map((b) => ({
      id: b.id,
      name: b.name,
      accountType: b.accountType,
      accountNumber: b.accountNumber,
      ifsc: b.ifsc,
      bankName: b.bankName,
      openingBalance: Number(b.openingBalance),
      ledgerAccount: b.ledgerAccount,
    })),
  });
}
