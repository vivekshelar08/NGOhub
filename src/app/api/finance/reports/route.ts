import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ensureAccountingSetup } from "@/lib/accounting";
import { parseDateOnly } from "@/lib/hr-utils";
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getFundWiseStatement,
  getFunctionalExpenseReport,
  getFcraAdminCapReport,
  getReceiptsAndPayments,
} from "@/lib/financial-reports";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureAccountingSetup(prisma);

  const { searchParams } = new URL(request.url);
  const report = searchParams.get("report") ?? "trial-balance";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const asOf = searchParams.get("asOf");

  const fromDate = from ? parseDateOnly(from) : undefined;
  const toDate = to ? parseDateOnly(to) : undefined;
  const asOfDate = asOf ? parseDateOnly(asOf) : undefined;

  switch (report) {
    case "trial-balance":
      return NextResponse.json({ report, data: await getTrialBalance(prisma, fromDate, toDate) });
    case "profit-loss":
      return NextResponse.json({ report, data: await getProfitAndLoss(prisma, fromDate, toDate) });
    case "balance-sheet":
      return NextResponse.json({ report, data: await getBalanceSheet(prisma, asOfDate ?? toDate) });
    case "fund-wise":
      return NextResponse.json({ report, data: await getFundWiseStatement(prisma, fromDate, toDate) });
    case "functional-expense":
      return NextResponse.json({
        report,
        data: await getFunctionalExpenseReport(prisma, fromDate, toDate),
      });
    case "fcra-admin-cap":
      return NextResponse.json({
        report,
        data: await getFcraAdminCapReport(prisma, fromDate, toDate),
      });
    case "receipts-payments":
      return NextResponse.json({
        report,
        data: await getReceiptsAndPayments(prisma, fromDate, toDate),
      });
    default:
      return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  }
}
