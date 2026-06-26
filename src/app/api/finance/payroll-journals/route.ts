import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const runs = await prisma.payrollRun.findMany({
    where: { status: "PAID", journalEntryId: { not: null } },
    orderBy: { periodEnd: "desc" },
    take: 24,
    include: {
      journalEntry: { select: { id: true, voucherNumber: true, entryDate: true } },
      createdBy: { select: { id: true, name: true } },
      lines: { select: { id: true, netPay: true, user: { select: { name: true } } } },
    },
  });

  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id,
      periodStart: r.periodStart.toISOString().slice(0, 10),
      periodEnd: r.periodEnd.toISOString().slice(0, 10),
      status: r.status,
      journalEntry: r.journalEntry,
      createdBy: r.createdBy,
      totalNet: r.lines.reduce((s, l) => s + Number(l.netPay), 0),
      employeeCount: r.lines.length,
    })),
  });
}
