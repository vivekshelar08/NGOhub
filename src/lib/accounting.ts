import { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  AccountCategory,
  ExpenseCategory,
  ExpenseFunction,
  FundRestriction,
  JournalSourceType,
  PaymentType,
} from "@/generated/prisma/enums";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface IndianFY {
  label: string;
  startDate: Date;
  endDate: Date;
}

export function getIndianFY(date = new Date()): IndianFY {
  const month = date.getMonth();
  const year = date.getFullYear();
  const fyStartYear = month >= 3 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  const label = `${fyStartYear}-${String(fyEndYear).slice(-2)}`;
  return {
    label,
    startDate: new Date(Date.UTC(fyStartYear, 3, 1)),
    endDate: new Date(Date.UTC(fyEndYear, 2, 31)),
  };
}

const DEFAULT_FUNDS = [
  { code: "UNR", name: "Unrestricted Fund", restriction: "UNRESTRICTED" as const, isFcra: false },
  { code: "CSR", name: "CSR Restricted Fund", restriction: "RESTRICTED" as const, isFcra: false },
  { code: "FCRA", name: "FCRA Fund", restriction: "RESTRICTED" as const, isFcra: true },
  { code: "GOV", name: "Government Grant Fund", restriction: "RESTRICTED" as const, isFcra: false },
];

const DEFAULT_COA: Array<{
  code: string;
  name: string;
  category: AccountCategory;
  expenseFunction?: ExpenseFunction;
  isFcra?: boolean;
  isSystem?: boolean;
}> = [
  { code: "1000", name: "Bank — Domestic", category: "ASSET", isSystem: true },
  { code: "1010", name: "Bank — FCRA (SBI NDMB)", category: "ASSET", isFcra: true, isSystem: true },
  { code: "1020", name: "Cash in Hand", category: "ASSET", isSystem: true },
  { code: "1100", name: "Accounts Receivable", category: "ASSET", isSystem: true },
  { code: "1200", name: "Fixed Assets", category: "ASSET", isSystem: true },
  { code: "2000", name: "Accounts Payable", category: "LIABILITY", isSystem: true },
  { code: "2100", name: "TDS Payable", category: "LIABILITY", isSystem: true },
  { code: "3000", name: "Unrestricted Net Assets", category: "EQUITY", isSystem: true },
  { code: "3010", name: "Restricted Net Assets", category: "EQUITY", isSystem: true },
  { code: "4000", name: "Donation Income", category: "INCOME", isSystem: true },
  { code: "4100", name: "CSR Grant Income", category: "INCOME", isSystem: true },
  { code: "4200", name: "Foreign Contribution (FCRA)", category: "INCOME", isFcra: true, isSystem: true },
  { code: "4300", name: "Government Grant Income", category: "INCOME", isSystem: true },
  { code: "4400", name: "Interest & Other Income", category: "INCOME", isSystem: true },
  { code: "5000", name: "Program Expenses", category: "EXPENSE", expenseFunction: "PROGRAM", isSystem: true },
  { code: "5100", name: "Travel & Conveyance", category: "EXPENSE", expenseFunction: "PROGRAM", isSystem: true },
  { code: "5200", name: "Administrative Expenses", category: "EXPENSE", expenseFunction: "ADMINISTRATIVE", isSystem: true },
  { code: "5300", name: "Salary & Wages", category: "EXPENSE", expenseFunction: "PROGRAM", isSystem: true },
  { code: "5400", name: "Fundraising Expenses", category: "EXPENSE", expenseFunction: "FUNDRAISING", isSystem: true },
  { code: "5500", name: "Stationery & Supplies", category: "EXPENSE", expenseFunction: "PROGRAM", isSystem: true },
];

async function ensureFinancialYearAndPeriods(prisma: DbClient) {
  const fy = getIndianFY();
  const financialYear = await prisma.financialYear.upsert({
    where: { label: fy.label },
    update: { isCurrent: true },
    create: {
      label: fy.label,
      startDate: fy.startDate,
      endDate: fy.endDate,
      isCurrent: true,
    },
  });

  for (let m = 0; m < 12; m++) {
    const monthIndex = (3 + m) % 12;
    const year = monthIndex >= 3 ? fy.startDate.getUTCFullYear() : fy.endDate.getUTCFullYear();
    await prisma.financialPeriod.upsert({
      where: {
        financialYearId_month_year: {
          financialYearId: financialYear.id,
          month: monthIndex + 1,
          year,
        },
      },
      update: {},
      create: {
        financialYearId: financialYear.id,
        month: monthIndex + 1,
        year,
        status: "OPEN",
      },
    });
  }

  return financialYear;
}

export async function ensureAccountingSetup(prisma: DbClient) {
  const currentFy = await prisma.financialYear.findFirst({ where: { isCurrent: true } });
  if (currentFy) {
    return { seeded: false };
  }

  const existing = await prisma.ledgerAccount.count();
  if (existing > 0) {
    await ensureFinancialYearAndPeriods(prisma);
    return { seeded: false };
  }

  try {
    for (const fund of DEFAULT_FUNDS) {
      await prisma.fund.upsert({
        where: { code: fund.code },
        update: {},
        create: fund,
      });
    }

    for (const account of DEFAULT_COA) {
      await prisma.ledgerAccount.upsert({
        where: { code: account.code },
        update: {},
        create: {
          code: account.code,
          name: account.name,
          category: account.category,
          expenseFunction: account.expenseFunction ?? "NONE",
          isFcra: account.isFcra ?? false,
          isSystem: account.isSystem ?? false,
        },
      });
    }

    const bankDomestic = await prisma.ledgerAccount.findUnique({ where: { code: "1000" } });
    const bankFcra = await prisma.ledgerAccount.findUnique({ where: { code: "1010" } });
    const cashLedger = await prisma.ledgerAccount.findUnique({ where: { code: "1020" } });

    const bankCount = await prisma.bankAccount.count();
    if (bankCount === 0) {
      if (bankDomestic) {
        await prisma.bankAccount.create({
          data: {
            name: "Main Operating Account",
            accountType: "DOMESTIC",
            ledgerAccountId: bankDomestic.id,
          },
        });
      }
      if (bankFcra) {
        await prisma.bankAccount.create({
          data: {
            name: "FCRA Account (SBI NDMB)",
            accountType: "FCRA",
            ledgerAccountId: bankFcra.id,
          },
        });
      }
      if (cashLedger) {
        await prisma.bankAccount.create({
          data: {
            name: "Petty Cash",
            accountType: "CASH",
            ledgerAccountId: cashLedger.id,
          },
        });
      }
    }

    const financialYear = await ensureFinancialYearAndPeriods(prisma);

    return { seeded: true, financialYearId: financialYear.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { seeded: false };
    }
    throw error;
  }
}

export async function getCurrentFinancialYear(prisma: DbClient) {
  let fy = await prisma.financialYear.findFirst({ where: { isCurrent: true } });
  if (!fy) {
    await ensureAccountingSetup(prisma as PrismaClient);
    fy = await prisma.financialYear.findFirst({ where: { isCurrent: true } });
  }
  if (!fy) throw new Error("Financial year not configured");
  return fy;
}

export async function isPeriodClosed(prisma: DbClient, date: Date): Promise<boolean> {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const fy = await getCurrentFinancialYear(prisma);
  const period = await prisma.financialPeriod.findFirst({
    where: { financialYearId: fy.id, month, year },
  });
  return period?.status === "CLOSED";
}

async function nextVoucherNumber(prisma: DbClient, financialYearId: string): Promise<string> {
  const fy = await prisma.financialYear.update({
    where: { id: financialYearId },
    data: { voucherCounter: { increment: 1 } },
  });
  return `JV/${fy.label}/${String(fy.voucherCounter).padStart(4, "0")}`;
}

export async function getAccountByCode(prisma: DbClient, code: string) {
  const account = await prisma.ledgerAccount.findUnique({ where: { code } });
  if (!account) throw new Error(`Ledger account ${code} not found. Run accounting setup.`);
  return account;
}

export async function getDefaultFund(prisma: DbClient, code = "UNR") {
  const fund = await prisma.fund.findUnique({ where: { code } });
  if (!fund) throw new Error(`Fund ${code} not found. Run accounting setup.`);
  return fund;
}

interface JournalLineInput {
  accountCode: string;
  debit?: number;
  credit?: number;
  fundId?: string | null;
  financeProjectId?: string | null;
  narration?: string;
}

export async function postJournalEntry(
  prisma: DbClient,
  params: {
    entryDate: Date;
    description: string;
    sourceType: JournalSourceType;
    sourceId?: string;
    createdById: string;
    lines: JournalLineInput[];
  }
) {
  if (await isPeriodClosed(prisma, params.entryDate)) {
    throw new Error("Cannot post to a closed accounting period");
  }

  const totalDebit = params.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = params.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal entry not balanced: Dr ${totalDebit} ≠ Cr ${totalCredit}`);
  }

  const fy = await getCurrentFinancialYear(prisma);
  const voucherNumber = await nextVoucherNumber(prisma, fy.id);

  const lineData = await Promise.all(
    params.lines.map(async (line) => {
      const account = await getAccountByCode(prisma, line.accountCode);
      return {
        ledgerAccountId: account.id,
        fundId: line.fundId ?? null,
        financeProjectId: line.financeProjectId ?? null,
        debit: line.debit ?? 0,
        credit: line.credit ?? 0,
        narration: line.narration,
      };
    })
  );

  return prisma.journalEntry.create({
    data: {
      voucherNumber,
      entryDate: params.entryDate,
      financialYearId: fy.id,
      description: params.description,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      status: "POSTED",
      createdById: params.createdById,
      lines: { create: lineData },
    },
    include: { lines: { include: { ledgerAccount: true, fund: true } } },
  });
}

function paymentAccountCode(paymentType: PaymentType): string {
  switch (paymentType) {
    case "CASH":
      return "1020";
    case "BANK_TRANSFER":
    case "UPI":
    case "CHEQUE":
    case "CARD":
    default:
      return "1000";
  }
}

function expenseAccountCode(category: ExpenseCategory): string {
  switch (category) {
    case "TRAVEL":
      return "5100";
    case "STATIONERY":
      return "5500";
    case "CAMP":
    case "OTHER":
    default:
      return "5000";
  }
}

export async function postExpenseJournal(
  prisma: PrismaClient,
  expenseId: string,
  userId: string
) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense || expense.status !== "APPROVED" || expense.journalEntryId) {
    return null;
  }

  const amount = Number(expense.amount);
  const fund = expense.fundId
    ? await prisma.fund.findUnique({ where: { id: expense.fundId } })
    : await getDefaultFund(prisma);

  const entry = await postJournalEntry(prisma, {
    entryDate: expense.expenseDate,
    description: `Expense claim — ${expense.description ?? expense.category}`,
    sourceType: "EXPENSE",
    sourceId: expenseId,
    createdById: userId,
    lines: [
      {
        accountCode: expenseAccountCode(expense.category),
        debit: amount,
        fundId: fund?.id,
        financeProjectId: expense.financeProjectId,
      },
      {
        accountCode: paymentAccountCode(expense.paymentType),
        credit: amount,
        fundId: fund?.id,
      },
    ],
  });

  await prisma.expense.update({
    where: { id: expenseId },
    data: { journalEntryId: entry.id },
  });

  await logFinanceAudit(prisma, {
    action: "EXPENSE_POSTED",
    entityType: "Expense",
    entityId: expenseId,
    userId,
    details: { voucherNumber: entry.voucherNumber, amount },
  });

  return entry;
}

export async function postDonationJournal(
  prisma: PrismaClient,
  donationId: string,
  userId: string
) {
  const donation = await prisma.donation.findUnique({ where: { id: donationId } });
  if (!donation || donation.journalEntryId) return null;

  const amount = Number(donation.amount);
  const fund = donation.fundId
    ? await prisma.fund.findUnique({ where: { id: donation.fundId } })
    : await getDefaultFund(prisma);

  const incomeCode = fund?.isFcra ? "4200" : fund?.code === "CSR" ? "4100" : "4000";
  const paymentCode =
    donation.paymentMode?.toLowerCase() === "cash" ? "1020" : fund?.isFcra ? "1010" : "1000";

  const entry = await postJournalEntry(prisma, {
    entryDate: donation.donationDate,
    description: `Donation from ${donation.donorName} — ${donation.receiptNumber}`,
    sourceType: "DONATION",
    sourceId: donationId,
    createdById: userId,
    lines: [
      {
        accountCode: paymentCode,
        debit: amount,
        fundId: fund?.id,
      },
      {
        accountCode: incomeCode,
        credit: amount,
        fundId: fund?.id,
        financeProjectId: donation.financeProjectId,
      },
    ],
  });

  await prisma.donation.update({
    where: { id: donationId },
    data: { journalEntryId: entry.id },
  });

  await logFinanceAudit(prisma, {
    action: "DONATION_POSTED",
    entityType: "Donation",
    entityId: donationId,
    userId,
    details: { voucherNumber: entry.voucherNumber, amount },
  });

  return entry;
}

export async function postPayrollJournal(
  prisma: PrismaClient,
  payrollRunId: string,
  userId: string
) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
    include: { lines: true },
  });
  if (!run || run.status !== "PAID" || run.journalEntryId) return null;

  const totalGross = run.lines.reduce((s, l) => s + Number(l.baseSalary) + Number(l.bonuses), 0);
  const totalNet = run.lines.reduce((s, l) => s + Number(l.netPay), 0);
  const totalDeductions = run.lines.reduce((s, l) => s + Number(l.deductions), 0);
  const fund = await getDefaultFund(prisma);

  const lines: JournalLineInput[] = [
    {
      accountCode: "5300",
      debit: totalGross,
      fundId: fund.id,
      narration: `Payroll ${run.periodStart.toISOString().slice(0, 10)} – ${run.periodEnd.toISOString().slice(0, 10)}`,
    },
    { accountCode: "1000", credit: totalNet, fundId: fund.id },
  ];
  if (totalDeductions > 0) {
    lines.push({ accountCode: "2100", credit: totalDeductions, fundId: fund.id });
  }

  const entry = await postJournalEntry(prisma, {
    entryDate: run.periodEnd,
    description: `Payroll run — ${run.periodStart.toISOString().slice(0, 10)} to ${run.periodEnd.toISOString().slice(0, 10)}`,
    sourceType: "PAYROLL",
    sourceId: payrollRunId,
    createdById: userId,
    lines,
  });

  await prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: { journalEntryId: entry.id },
  });

  await logFinanceAudit(prisma, {
    action: "PAYROLL_POSTED",
    entityType: "PayrollRun",
    entityId: payrollRunId,
    userId,
    details: { voucherNumber: entry.voucherNumber, totalGross, totalNet },
  });

  return entry;
}

export async function postVendorBillJournal(
  prisma: PrismaClient,
  billId: string,
  userId: string
) {
  const bill = await prisma.vendorBill.findUnique({
    where: { id: billId },
    include: { ledgerAccount: true },
  });
  if (!bill || bill.status !== "APPROVED" || bill.journalEntryId) return null;

  const amount = Number(bill.amount);
  const expenseCode = bill.ledgerAccount?.code ?? "5200";
  const fund = bill.fundId
    ? await prisma.fund.findUnique({ where: { id: bill.fundId } })
    : await getDefaultFund(prisma);

  const entry = await postJournalEntry(prisma, {
    entryDate: bill.billDate,
    description: `Vendor bill ${bill.billNumber}`,
    sourceType: "VENDOR_BILL",
    sourceId: billId,
    createdById: userId,
    lines: [
      {
        accountCode: expenseCode,
        debit: amount,
        fundId: fund?.id,
        financeProjectId: bill.financeProjectId,
      },
      { accountCode: "2000", credit: amount, fundId: fund?.id },
    ],
  });

  await prisma.vendorBill.update({
    where: { id: billId },
    data: { journalEntryId: entry.id },
  });

  await logFinanceAudit(prisma, {
    action: "VENDOR_BILL_POSTED",
    entityType: "VendorBill",
    entityId: billId,
    userId,
    details: { voucherNumber: entry.voucherNumber, amount },
  });

  return entry;
}

export async function postVendorPaymentJournal(
  prisma: PrismaClient,
  paymentId: string,
  userId: string
) {
  const payment = await prisma.vendorPayment.findUnique({
    where: { id: paymentId },
    include: { bankAccount: { include: { ledgerAccount: true } } },
  });
  if (!payment || payment.journalEntryId) return null;

  const amount = Number(payment.amount);
  const bankCode = payment.bankAccount?.ledgerAccount.code ?? "1000";

  const entry = await postJournalEntry(prisma, {
    entryDate: payment.paymentDate,
    description: `Vendor payment — ${payment.reference ?? payment.id.slice(0, 8)}`,
    sourceType: "VENDOR_PAYMENT",
    sourceId: paymentId,
    createdById: userId,
    lines: [
      { accountCode: "2000", debit: amount },
      { accountCode: bankCode, credit: amount },
    ],
  });

  await prisma.vendorPayment.update({
    where: { id: paymentId },
    data: { journalEntryId: entry.id },
  });

  if (payment.vendorBillId) {
    await prisma.vendorBill.update({
      where: { id: payment.vendorBillId },
      data: { status: "PAID" },
    });
  }

  await logFinanceAudit(prisma, {
    action: "VENDOR_PAYMENT_POSTED",
    entityType: "VendorPayment",
    entityId: paymentId,
    userId,
    details: { voucherNumber: entry.voucherNumber, amount },
  });

  return entry;
}

export async function logFinanceAudit(
  prisma: DbClient,
  params: {
    action: string;
    entityType: string;
    entityId?: string;
    userId: string;
    details?: Record<string, unknown>;
  }
) {
  return prisma.financeAuditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      details: params.details as Prisma.InputJsonValue,
    },
  });
}

export { FUND_RESTRICTION_LABELS, ACCOUNT_CATEGORY_LABELS } from "./accounting-labels";