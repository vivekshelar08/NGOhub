import { PrismaClient } from "@/generated/prisma/client";
import { AccountCategory } from "@/generated/prisma/enums";
import { getCurrentFinancialYear } from "@/lib/accounting";

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  category: AccountCategory;
  debit: number;
  credit: number;
  balance: number;
}

export async function getTrialBalance(
  prisma: PrismaClient,
  fromDate?: Date,
  toDate?: Date
): Promise<TrialBalanceRow[]> {
  const fy = await getCurrentFinancialYear(prisma);
  const start = fromDate ?? fy.startDate;
  const end = toDate ?? fy.endDate;

  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        status: "POSTED",
        entryDate: { gte: start, lte: end },
      },
    },
    include: { ledgerAccount: true },
  });

  const byAccount = new Map<string, TrialBalanceRow>();

  for (const line of lines) {
    const key = line.ledgerAccountId;
    const existing = byAccount.get(key) ?? {
      accountCode: line.ledgerAccount.code,
      accountName: line.ledgerAccount.name,
      category: line.ledgerAccount.category,
      debit: 0,
      credit: 0,
      balance: 0,
    };
    existing.debit += Number(line.debit);
    existing.credit += Number(line.credit);
    byAccount.set(key, existing);
  }

  return Array.from(byAccount.values())
    .map((row) => ({
      ...row,
      balance: row.debit - row.credit,
    }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

export interface PLRow {
  accountCode: string;
  accountName: string;
  expenseFunction: string;
  amount: number;
}

export async function getProfitAndLoss(prisma: PrismaClient, fromDate?: Date, toDate?: Date) {
  const fy = await getCurrentFinancialYear(prisma);
  const start = fromDate ?? fy.startDate;
  const end = toDate ?? fy.endDate;

  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { status: "POSTED", entryDate: { gte: start, lte: end } },
      ledgerAccount: { category: { in: ["INCOME", "EXPENSE"] } },
    },
    include: { ledgerAccount: true },
  });

  const income: PLRow[] = [];
  const expenses: PLRow[] = [];

  const incomeMap = new Map<string, PLRow>();
  const expenseMap = new Map<string, PLRow>();

  for (const line of lines) {
    const acc = line.ledgerAccount;
    const net = Number(line.credit) - Number(line.debit);
    const map = acc.category === "INCOME" ? incomeMap : expenseMap;
    const existing = map.get(acc.id) ?? {
      accountCode: acc.code,
      accountName: acc.name,
      expenseFunction: acc.expenseFunction,
      amount: 0,
    };
    existing.amount += net;
    map.set(acc.id, existing);
  }

  income.push(...incomeMap.values());
  expenses.push(...expenseMap.values());

  const totalIncome = income.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenses.reduce((s, r) => s + Math.abs(r.amount), 0);

  return {
    income: income.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
    expenses: expenses
      .map((e) => ({ ...e, amount: Math.abs(e.amount) }))
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
    totalIncome,
    totalExpense,
    surplus: totalIncome - totalExpense,
    period: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
  };
}

export async function getBalanceSheet(prisma: PrismaClient, asOfDate?: Date) {
  const fy = await getCurrentFinancialYear(prisma);
  const end = asOfDate ?? new Date();

  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { status: "POSTED", entryDate: { lte: end } },
      ledgerAccount: { category: { in: ["ASSET", "LIABILITY", "EQUITY"] } },
    },
    include: { ledgerAccount: true },
  });

  const assets: Array<{ code: string; name: string; balance: number }> = [];
  const liabilities: Array<{ code: string; name: string; balance: number }> = [];
  const equity: Array<{ code: string; name: string; balance: number }> = [];

  const map = new Map<string, { code: string; name: string; category: AccountCategory; balance: number }>();

  for (const line of lines) {
    const acc = line.ledgerAccount;
    const existing = map.get(acc.id) ?? {
      code: acc.code,
      name: acc.name,
      category: acc.category,
      balance: 0,
    };
    existing.balance += Number(line.debit) - Number(line.credit);
    map.set(acc.id, existing);
  }

  for (const row of map.values()) {
    const item = { code: row.code, name: row.name, balance: row.balance };
    if (row.category === "ASSET") assets.push(item);
    else if (row.category === "LIABILITY") liabilities.push({ ...item, balance: -row.balance });
    else equity.push({ ...item, balance: -row.balance });
  }

  const sortByCode = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code);

  return {
    assets: assets.sort(sortByCode),
    liabilities: liabilities.sort(sortByCode),
    equity: equity.sort(sortByCode),
    totalAssets: assets.reduce((s, r) => s + r.balance, 0),
    totalLiabilities: liabilities.reduce((s, r) => s + r.balance, 0),
    totalEquity: equity.reduce((s, r) => s + r.balance, 0),
    asOf: end.toISOString().slice(0, 10),
    financialYear: fy.label,
  };
}

export async function getFundWiseStatement(prisma: PrismaClient, fromDate?: Date, toDate?: Date) {
  const fy = await getCurrentFinancialYear(prisma);
  const start = fromDate ?? fy.startDate;
  const end = toDate ?? fy.endDate;

  const funds = await prisma.fund.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });

  const lines = await prisma.journalLine.findMany({
    where: {
      fundId: { not: null },
      journalEntry: { status: "POSTED", entryDate: { gte: start, lte: end } },
    },
    include: { fund: true, ledgerAccount: true },
  });

  return funds.map((fund) => {
    const fundLines = lines.filter((l) => l.fundId === fund.id);
    let income = 0;
    let expense = 0;
    for (const line of fundLines) {
      const net = Number(line.credit) - Number(line.debit);
      if (line.ledgerAccount.category === "INCOME") income += net;
      if (line.ledgerAccount.category === "EXPENSE") expense += Number(line.debit) - Number(line.credit);
    }
    return {
      fundCode: fund.code,
      fundName: fund.name,
      restriction: fund.restriction,
      isFcra: fund.isFcra,
      income,
      expense,
      net: income - expense,
    };
  });
}

export async function getFunctionalExpenseReport(prisma: PrismaClient, fromDate?: Date, toDate?: Date) {
  const fy = await getCurrentFinancialYear(prisma);
  const start = fromDate ?? fy.startDate;
  const end = toDate ?? fy.endDate;

  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { status: "POSTED", entryDate: { gte: start, lte: end } },
      ledgerAccount: { category: "EXPENSE" },
    },
    include: { ledgerAccount: true },
  });

  const byFunction = new Map<string, number>();
  for (const line of lines) {
    const fn = line.ledgerAccount.expenseFunction;
    byFunction.set(fn, (byFunction.get(fn) ?? 0) + Number(line.debit) - Number(line.credit));
  }

  return {
    program: byFunction.get("PROGRAM") ?? 0,
    administrative: byFunction.get("ADMINISTRATIVE") ?? 0,
    fundraising: byFunction.get("FUNDRAISING") ?? 0,
    other: byFunction.get("NONE") ?? 0,
    total: Array.from(byFunction.values()).reduce((s, v) => s + v, 0),
    period: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
  };
}

export async function getFcraAdminCapReport(prisma: PrismaClient, fromDate?: Date, toDate?: Date) {
  const fy = await getCurrentFinancialYear(prisma);
  const start = fromDate ?? fy.startDate;
  const end = toDate ?? fy.endDate;

  const fcraFund = await prisma.fund.findFirst({ where: { isFcra: true } });
  if (!fcraFund) return { fcraIncome: 0, adminExpense: 0, capPercent: 20, utilizationPercent: 0, withinCap: true };

  const lines = await prisma.journalLine.findMany({
    where: {
      fundId: fcraFund.id,
      journalEntry: { status: "POSTED", entryDate: { gte: start, lte: end } },
    },
    include: { ledgerAccount: true },
  });

  let fcraIncome = 0;
  let adminExpense = 0;
  for (const line of lines) {
    if (line.ledgerAccount.category === "INCOME") {
      fcraIncome += Number(line.credit) - Number(line.debit);
    }
    if (line.ledgerAccount.expenseFunction === "ADMINISTRATIVE") {
      adminExpense += Number(line.debit) - Number(line.credit);
    }
  }

  const maxAdmin = fcraIncome * 0.2;
  return {
    fcraIncome,
    adminExpense,
    maxAdminAllowed: maxAdmin,
    capPercent: 20,
    utilizationPercent: fcraIncome > 0 ? (adminExpense / fcraIncome) * 100 : 0,
    withinCap: adminExpense <= maxAdmin,
    period: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
  };
}

export async function getReceiptsAndPayments(prisma: PrismaClient, fromDate?: Date, toDate?: Date) {
  const fy = await getCurrentFinancialYear(prisma);
  const start = fromDate ?? fy.startDate;
  const end = toDate ?? fy.endDate;

  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { status: "POSTED", entryDate: { gte: start, lte: end } },
      ledgerAccount: { code: { in: ["1000", "1010", "1020"] } },
    },
    include: { ledgerAccount: true, journalEntry: true },
  });

  const receipts: Array<{ date: string; description: string; amount: number }> = [];
  const payments: Array<{ date: string; description: string; amount: number }> = [];

  for (const line of lines) {
    const debit = Number(line.debit);
    const credit = Number(line.credit);
    const date = line.journalEntry.entryDate.toISOString().slice(0, 10);
    const description = line.narration ?? line.journalEntry.description ?? "";
    if (debit > 0) receipts.push({ date, description, amount: debit });
    if (credit > 0) payments.push({ date, description, amount: credit });
  }

  return {
    receipts,
    payments,
    totalReceipts: receipts.reduce((s, r) => s + r.amount, 0),
    totalPayments: payments.reduce((s, r) => s + r.amount, 0),
    period: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
  };
}
