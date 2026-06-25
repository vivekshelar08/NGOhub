import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ensureAccountingSetup } from "@/lib/accounting";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await ensureAccountingSetup(prisma);
  return NextResponse.json(result);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [accounts, funds, fy, bankAccounts] = await Promise.all([
    prisma.ledgerAccount.count(),
    prisma.fund.count(),
    prisma.financialYear.findFirst({ where: { isCurrent: true } }),
    prisma.bankAccount.count(),
  ]);

  return NextResponse.json({
    initialized: accounts > 0,
    accountCount: accounts,
    fundCount: funds,
    bankAccountCount: bankAccounts,
    currentFinancialYear: fy?.label ?? null,
  });
}
