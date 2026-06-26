import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ensureAccountingSetup, getCurrentFinancialYear, logFinanceAudit } from "@/lib/accounting";

const actionSchema = z.object({
  periodId: z.string(),
  action: z.enum(["close", "reopen"]).default("close"),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.period_close")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureAccountingSetup(prisma);
  const fy = await getCurrentFinancialYear(prisma);

  const periods = await prisma.financialPeriod.findMany({
    where: { financialYearId: fy.id },
    orderBy: [{ year: "asc" }, { month: "asc" }],
    include: { closedBy: { select: { id: true, name: true } } },
  });

  const auditLogs = await prisma.financeAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    financialYear: fy.label,
    periods: periods.map((p) => ({
      id: p.id,
      month: p.month,
      year: p.year,
      status: p.status,
      closedAt: p.closedAt?.toISOString() ?? null,
      closedBy: p.closedBy,
    })),
    auditLogs: auditLogs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      details: l.details,
      user: l.user,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.period_close")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const period = await prisma.financialPeriod.findUnique({
    where: { id: parsed.data.periodId },
  });
  if (!period) {
    return NextResponse.json({ error: "Period not found" }, { status: 404 });
  }

  if (parsed.data.action === "reopen") {
    if (!hasFeature(user.role, "admin.access") && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admin can reopen periods" }, { status: 403 });
    }
    if (period.status === "OPEN") {
      return NextResponse.json({ error: "Period is already open" }, { status: 400 });
    }
    const updated = await prisma.financialPeriod.update({
      where: { id: period.id },
      data: { status: "OPEN", closedAt: null, closedById: null },
    });
    await logFinanceAudit(prisma, {
      action: "PERIOD_REOPENED",
      entityType: "FinancialPeriod",
      entityId: period.id,
      userId: user.id,
      details: { month: period.month, year: period.year },
    });
    return NextResponse.json({ period: updated });
  }

  if (period.status === "CLOSED") {
    return NextResponse.json({ error: "Period already closed" }, { status: 400 });
  }

  const updated = await prisma.financialPeriod.update({
    where: { id: period.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedById: user.id,
    },
  });

  await logFinanceAudit(prisma, {
    action: "PERIOD_CLOSED",
    entityType: "FinancialPeriod",
    entityId: period.id,
    userId: user.id,
    details: { month: period.month, year: period.year },
  });

  return NextResponse.json({ period: updated });
}
