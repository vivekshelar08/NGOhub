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
