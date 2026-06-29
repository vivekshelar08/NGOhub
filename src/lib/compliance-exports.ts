import { PrismaClient } from "@/generated/prisma/client";
import { getIndianFY } from "@/lib/accounting";
import {
  getBalanceSheet,
  getFcraAdminCapReport,
  getFundWiseStatement,
  getFunctionalExpenseReport,
  getProfitAndLoss,
} from "@/lib/financial-reports";

/** Form 10BD — annual statement of donations (80G compliance). */
export async function buildForm10BDData(prisma: PrismaClient, fyLabel?: string) {
  const fy = fyLabel ? parseFYLabel(fyLabel) : getIndianFY();
  const donations = await prisma.donation.findMany({
    where: {
      is80GEligible: true,
      donationDate: { gte: fy.startDate, lte: fy.endDate },
    },
    orderBy: { donationDate: "asc" },
  });

  return {
    form: "10BD",
    financialYear: fy.label,
    organization: await getOrgDetails(prisma),
    totalDonations: donations.length,
    totalAmount: donations.reduce((s, d) => s + Number(d.amount), 0),
    donors: donations.map((d) => ({
      donorName: d.donorName,
      donorPan: d.donorPan,
      amount: Number(d.amount),
      donationDate: d.donationDate.toISOString().slice(0, 10),
      receiptNumber: d.receiptNumber,
      paymentMode: d.paymentMode,
      section80G: true,
    })),
    filingDeadline: `${fy.endDate.getUTCFullYear()}-05-31`,
    note: "File electronically on Income Tax portal. Issue Form 10BE certificates to donors.",
  };
}

/** FCRA FC-4 schedule data for annual return. */
export async function buildFc4ScheduleData(prisma: PrismaClient, fyLabel?: string) {
  const fy = fyLabel ? parseFYLabel(fyLabel) : getIndianFY();
  const fundWise = await getFundWiseStatement(prisma, fy.startDate, fy.endDate);
  const fcra = fundWise.find((f) => f.isFcra);
  const adminCap = await getFcraAdminCapReport(prisma, fy.startDate, fy.endDate);
  const fcraDonations = await prisma.donation.findMany({
    where: {
      donationDate: { gte: fy.startDate, lte: fy.endDate },
      fund: { isFcra: true },
    },
  });

  return {
    form: "FC-4",
    financialYear: fy.label,
    organization: await getOrgDetails(prisma),
    foreignContributionReceived: fcra?.income ?? 0,
    applicationOfFunds: fcra?.expense ?? 0,
    unspentBalance: (fcra?.income ?? 0) - (fcra?.expense ?? 0),
    administrativeExpenses: adminCap.adminExpense,
    adminCapPercent: 20,
    adminWithinCap: adminCap.withinCap,
    designatedBank: "State Bank of India, New Delhi Main Branch",
    foreignDonations: fcraDonations.map((d) => ({
      donorName: d.donorName,
      amount: Number(d.amount),
      date: d.donationDate.toISOString().slice(0, 10),
      purpose: d.purpose,
    })),
    filingDeadline: `${fy.startDate.getUTCFullYear() + 1}-12-31`,
  };
}

/** Form 112 audit prep pack (replaces 10B/10BB from FY 2026-27). */
export async function buildForm112PrepPack(prisma: PrismaClient, fyLabel?: string) {
  const fy = fyLabel ? parseFYLabel(fyLabel) : getIndianFY();
  const pl = await getProfitAndLoss(prisma, fy.startDate, fy.endDate);
  const bs = await getBalanceSheet(prisma, fy.endDate);
  const functional = await getFunctionalExpenseReport(prisma, fy.startDate, fy.endDate);
  const fundWise = await getFundWiseStatement(prisma, fy.startDate, fy.endDate);
  const fcra = await buildFc4ScheduleData(prisma, fy.label);

  const regularIncome = pl.totalIncome;
  const isSmallNpo =
    regularIncome <= 5_00_00_000 &&
    (fcra.foreignContributionReceived ?? 0) <= 10_00_000;

  return {
    form: "112",
    financialYear: fy.label,
    npoClassification: isSmallNpo ? "SMALL" : "LARGE",
    organization: await getOrgDetails(prisma),
    incomeAndExpenditure: {
      totalIncome: pl.totalIncome,
      totalExpense: pl.totalExpense,
      surplus: pl.surplus,
      incomeBreakdown: pl.income,
      expenseBreakdown: pl.expenses,
    },
    balanceSheet: bs,
    functionalExpenses: functional,
    fundWiseStatement: fundWise,
    foreignContribution: {
      received: fcra.foreignContributionReceived,
      applied: fcra.applicationOfFunds,
      unspent: fcra.unspentBalance,
    },
    applicationOfIncome: {
      programPercent: functional.total > 0 ? (functional.program / functional.total) * 100 : 0,
      adminPercent: functional.total > 0 ? (functional.administrative / functional.total) * 100 : 0,
      meets85PercentRule: pl.totalIncome > 0 ? (functional.program / pl.totalIncome) * 100 >= 85 : false,
    },
    filingDeadline: `${fy.endDate.getUTCFullYear()}-09-30`,
    itrDeadline: `${fy.endDate.getUTCFullYear()}-10-31`,
    requiredDocuments: [
      "Instrument Deed / Registration documents",
      "12A / 80G approval letters",
      "Audited financial statements",
      "FCRA return (if applicable)",
      "TDS returns and AIS",
    ],
  };
}

/** CSR Form 1 / Annexure II — project-wise spend for CSR implementers. */
export async function buildCsrAnnexureData(prisma: PrismaClient, fyLabel?: string) {
  const fy = fyLabel ? parseFYLabel(fyLabel) : getIndianFY();
  const projects = await prisma.financeProject.findMany({
    where: { isActive: true },
    include: {
      expenses: {
        where: {
          status: "APPROVED",
          expenseDate: { gte: fy.startDate, lte: fy.endDate },
        },
      },
      milestoneBudgets: true,
    },
  });

  const beneficiaries = await prisma.beneficiary.groupBy({
    by: ["projectId"],
    where: { isRemoved: false, createdAt: { gte: fy.startDate, lte: fy.endDate } },
    _count: { id: true },
  });
  const benMap = new Map(beneficiaries.map((b) => [b.projectId, b._count.id]));

  return {
    form: "CSR-ANNEXURE-II",
    financialYear: fy.label,
    organization: await getOrgDetails(prisma),
    projects: projects.map((p) => ({
      projectCode: p.code,
      projectName: p.name,
      donorName: p.donorName,
      totalBudget: p.totalBudget ? Number(p.totalBudget) : null,
      totalSpent: p.expenses.reduce((s, e) => s + Number(e.amount), 0),
      milestonesAchieved: p.milestoneBudgets.filter((m) => Number(m.achievementPct) >= 100).length,
      milestoneCount: p.milestoneBudgets.length,
      beneficiariesReached: benMap.get(p.legacyProjectId ?? "") ?? 0,
    })),
    filingNote: "Attach to CSR Form 1 as implementing agency annexure.",
  };
}

/** TDS Form 26Q quarterly summary from vendor bills. */
export async function buildTds26QData(
  prisma: PrismaClient,
  quarter: 1 | 2 | 3 | 4,
  fyLabel?: string
) {
  const fy = fyLabel ? parseFYLabel(fyLabel) : getIndianFY();
  const qStart = new Date(fy.startDate);
  qStart.setUTCMonth(qStart.getUTCMonth() + (quarter - 1) * 3);
  const qEnd = new Date(qStart);
  qEnd.setUTCMonth(qEnd.getUTCMonth() + 3);
  qEnd.setUTCDate(qEnd.getUTCDate() - 1);

  const bills = await prisma.vendorBill.findMany({
    where: {
      billDate: { gte: qStart, lte: qEnd },
      tdsAmount: { gt: 0 },
      status: { in: ["APPROVED", "PAID"] },
    },
    include: { vendor: true },
  });

  const bySection = new Map<string, { vendors: number; tds: number; gross: number }>();
  for (const b of bills) {
    const section = b.vendor.tdsSection ?? "194C";
    const cur = bySection.get(section) ?? { vendors: 0, tds: 0, gross: 0 };
    cur.vendors += 1;
    cur.tds += Number(b.tdsAmount);
    cur.gross += Number(b.amount);
    bySection.set(section, cur);
  }

  return {
    form: "26Q",
    financialYear: fy.label,
    quarter,
    period: { start: qStart.toISOString().slice(0, 10), end: qEnd.toISOString().slice(0, 10) },
    organization: await getOrgDetails(prisma),
    totalTdsDeducted: bills.reduce((s, b) => s + Number(b.tdsAmount), 0),
    sections: [...bySection.entries()].map(([section, data]) => ({ section, ...data })),
    deductees: bills.map((b) => ({
      vendorName: b.vendor.name,
      pan: b.vendor.pan,
      section: b.vendor.tdsSection,
      billAmount: Number(b.amount),
      tdsAmount: Number(b.tdsAmount),
      billDate: b.billDate.toISOString().slice(0, 10),
    })),
  };
}

/** GSTR-ready export from vendor bills with GST. */
export async function buildGstSummaryData(prisma: PrismaClient, month: number, year: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));

  const bills = await prisma.vendorBill.findMany({
    where: {
      billDate: { gte: start, lte: end },
      gstAmount: { gt: 0 },
      status: { in: ["APPROVED", "PAID"] },
    },
    include: { vendor: true },
  });

  const taxable = bills.reduce((s, b) => s + Number(b.amount) - Number(b.gstAmount), 0);
  const gst = bills.reduce((s, b) => s + Number(b.gstAmount), 0);

  return {
    form: "GSTR-SUMMARY",
    period: `${year}-${String(month).padStart(2, "0")}`,
    organization: await getOrgDetails(prisma),
    invoiceCount: bills.length,
    taxableValue: taxable,
    totalGst: gst,
    invoices: bills.map((b) => ({
      vendorName: b.vendor.name,
      gstin: b.vendor.gstin,
      billNumber: b.billNumber,
      billDate: b.billDate.toISOString().slice(0, 10),
      taxableAmount: Number(b.amount) - Number(b.gstAmount),
      gstAmount: Number(b.gstAmount),
      total: Number(b.amount),
    })),
  };
}

/** NGO Darpan renewal reminders from compliance calendar. */
export async function buildDarpanReminders(prisma: PrismaClient) {
  const items = await prisma.complianceItem.findMany({
    where: { type: "NGO_DARPAN" },
    orderBy: { dueDate: "asc" },
  });
  const now = new Date();
  return {
    form: "DARPAN-REMINDERS",
    organization: await getOrgDetails(prisma),
    registrations: items.map((i) => ({
      title: i.title,
      dueDate: i.dueDate.toISOString().slice(0, 10),
      status: i.status,
      daysUntilDue: Math.ceil((i.dueDate.getTime() - now.getTime()) / 86400000),
      filedAt: i.filedAt?.toISOString() ?? null,
    })),
    portalUrl: "https://ngodarpan.gov.in",
    note: "Renew NGO Darpan registration before expiry. Upload updated documents to vault.",
  };
}

/** Form 10BE donor certificate data (paired with 10BD). */
export async function buildForm10BEData(prisma: PrismaClient, fyLabel?: string) {
  const bd = await buildForm10BDData(prisma, fyLabel);
  return {
    form: "10BE",
    financialYear: bd.financialYear,
    organization: bd.organization,
    certificates: bd.donors.map((d) => ({
      donorName: d.donorName,
      donorPan: d.donorPan,
      amount: d.amount,
      receiptNumber: d.receiptNumber,
      donationDate: d.donationDate,
      certificateText: `We certify that ${d.donorName} has donated ₹${d.amount} eligible for deduction u/s 80G.`,
    })),
    issueDeadline: bd.filingDeadline,
  };
}

function parseFYLabel(label: string): ReturnType<typeof getIndianFY> {
  const [startYear] = label.split("-").map(Number);
  return {
    label,
    startDate: new Date(Date.UTC(startYear, 3, 1)),
    endDate: new Date(Date.UTC(startYear + 1, 2, 31)),
  };
}

async function getOrgDetails(prisma: PrismaClient) {
  const settings = await prisma.orgSettings.findUnique({ where: { id: "default" } });
  return {
    name: settings?.orgName ?? "Organization",
    address: settings?.orgAddress,
    pan: settings?.orgPan,
    registration80G: settings?.org80G,
    registration12A: settings?.org12A,
    fcraRegistration: settings?.orgFcra,
  };
}
