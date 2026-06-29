import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { parseDateOnly } from "@/lib/hr-utils";
import {
  approveUtilizationCertificate,
  createGrantInvoiceFromUc,
  createUtilizationCertificate,
  getMilestoneBudgetVsActual,
  getWorkflowState,
  recordGrantPayment,
  submitUtilizationCertificate,
  syncMilestoneBudgets,
} from "@/lib/ngo-finance-workflow";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.accounting")) {
    return forbidden();
  }

  const { searchParams } = new URL(request.url);
  const financeProjectId = searchParams.get("financeProjectId");
  const report = searchParams.get("report");

  if (report === "milestone-budget-vs-actual") {
    const rows = await getMilestoneBudgetVsActual(prisma, financeProjectId ?? undefined);
    return NextResponse.json({ rows });
  }

  if (!financeProjectId) {
    const projects = await prisma.financeProject.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        legacyProjectId: true,
        totalBudget: true,
        donorName: true,
        _count: { select: { milestoneBudgets: true } },
      },
    });
    return NextResponse.json({
      projects: projects.map((p) => ({
        ...p,
        totalBudget: p.totalBudget ? Number(p.totalBudget) : null,
      })),
    });
  }

  const state = await getWorkflowState(prisma, financeProjectId);
  if (!state) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json(state);
}

const syncSchema = z.object({
  action: z.literal("sync_milestones"),
  financeProjectId: z.string(),
  totalBudget: z.number().positive(),
  milestones: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      budgetPercent: z.number(),
      kpis: z.array(
        z.object({
          achievedActivityCount: z.number().optional(),
          activityCount: z.number().optional(),
          achievedBeneficiaryCount: z.number().optional(),
          beneficiaryCount: z.number().optional(),
        })
      ),
    })
  ),
});

const ucSchema = z.object({
  action: z.literal("create_uc"),
  milestoneBudgetId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  expenseIds: z.array(z.string()).min(1),
  notes: z.string().optional(),
});

const ucActionSchema = z.object({
  action: z.enum(["submit_uc", "approve_uc"]),
  ucId: z.string(),
});

const invoiceSchema = z.object({
  action: z.literal("create_invoice"),
  ucId: z.string(),
  donorName: z.string().min(1),
  donorPan: z.string().optional(),
  invoiceDate: z.string(),
  description: z.string().optional(),
});

const paymentSchema = z.object({
  action: z.literal("record_payment"),
  invoiceId: z.string(),
  paymentDate: z.string(),
  amount: z.number().positive(),
  paymentMode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD"]).optional(),
  reference: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.accounting")) {
    return forbidden();
  }

  const body = await request.json();

  const syncParsed = syncSchema.safeParse(body);
  if (syncParsed.success) {
    const milestones = await syncMilestoneBudgets(
      prisma,
      syncParsed.data.financeProjectId,
      syncParsed.data.milestones,
      syncParsed.data.totalBudget
    );
    return NextResponse.json({ milestones: milestones.length });
  }

  const ucParsed = ucSchema.safeParse(body);
  if (ucParsed.success) {
    try {
      const uc = await createUtilizationCertificate(prisma, {
        milestoneBudgetId: ucParsed.data.milestoneBudgetId,
        periodStart: parseDateOnly(ucParsed.data.periodStart),
        periodEnd: parseDateOnly(ucParsed.data.periodEnd),
        expenseIds: ucParsed.data.expenseIds,
        notes: ucParsed.data.notes,
        userId: user.id,
      });
      return NextResponse.json({ uc: { id: uc.id } }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create UC";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const ucActionParsed = ucActionSchema.safeParse(body);
  if (ucActionParsed.success) {
    try {
      const uc =
        ucActionParsed.data.action === "submit_uc"
          ? await submitUtilizationCertificate(prisma, ucActionParsed.data.ucId, user.id)
          : await approveUtilizationCertificate(prisma, ucActionParsed.data.ucId, user.id);
      return NextResponse.json({ uc: { id: uc.id, status: uc.status } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "UC action failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const invoiceParsed = invoiceSchema.safeParse(body);
  if (invoiceParsed.success) {
    try {
      const invoice = await createGrantInvoiceFromUc(prisma, {
        ucId: invoiceParsed.data.ucId,
        donorName: invoiceParsed.data.donorName,
        donorPan: invoiceParsed.data.donorPan,
        invoiceDate: parseDateOnly(invoiceParsed.data.invoiceDate),
        description: invoiceParsed.data.description,
        userId: user.id,
      });
      return NextResponse.json(
        { invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber } },
        { status: 201 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invoice failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const paymentParsed = paymentSchema.safeParse(body);
  if (paymentParsed.success) {
    try {
      const result = await recordGrantPayment(prisma, {
        invoiceId: paymentParsed.data.invoiceId,
        paymentDate: parseDateOnly(paymentParsed.data.paymentDate),
        amount: paymentParsed.data.amount,
        paymentMode: paymentParsed.data.paymentMode,
        reference: paymentParsed.data.reference,
        userId: user.id,
      });
      return NextResponse.json({
        payment: { id: result.payment.id },
        voucherNumber: result.entry.voucherNumber,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
