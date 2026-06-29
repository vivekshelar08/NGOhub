import { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  GrantInvoiceStatus,
  MilestoneFinanceStatus,
  UtilizationCertificateStatus,
} from "@/generated/prisma/enums";
import {
  ensureAccountingSetup,
  logFinanceAudit,
  postJournalEntry,
} from "@/lib/accounting";

type Db = PrismaClient | Prisma.TransactionClient;

export interface LegacyMilestoneInput {
  id: string;
  name: string;
  budgetPercent: number;
  kpis: Array<{
    achievedActivityCount?: number;
    activityCount?: number;
    achievedBeneficiaryCount?: number;
    beneficiaryCount?: number;
  }>;
}

function milestoneAchievementPct(milestone: LegacyMilestoneInput): number {
  let target = 0;
  let achieved = 0;
  for (const kpi of milestone.kpis) {
    target += (kpi.activityCount ?? 0) + (kpi.beneficiaryCount ?? 0);
    achieved += (kpi.achievedActivityCount ?? 0) + (kpi.achievedBeneficiaryCount ?? 0);
  }
  if (target <= 0) return 0;
  return Math.min(100, (achieved / target) * 100);
}

function milestoneCounts(milestone: LegacyMilestoneInput) {
  return milestone.kpis.reduce(
    (acc, kpi) => ({
      targetActivities: acc.targetActivities + (kpi.activityCount ?? 0),
      achievedActivities: acc.achievedActivities + (kpi.achievedActivityCount ?? 0),
      targetBeneficiaries: acc.targetBeneficiaries + (kpi.beneficiaryCount ?? 0),
      achievedBeneficiaries: acc.achievedBeneficiaries + (kpi.achievedBeneficiaryCount ?? 0),
    }),
    {
      targetActivities: 0,
      achievedActivities: 0,
      targetBeneficiaries: 0,
      achievedBeneficiaries: 0,
    }
  );
}

function deriveMilestoneStatus(
  achievementPct: number,
  current: MilestoneFinanceStatus
): MilestoneFinanceStatus {
  if (
    current === MilestoneFinanceStatus.UC_DRAFT ||
    current === MilestoneFinanceStatus.UC_SUBMITTED ||
    current === MilestoneFinanceStatus.UC_APPROVED ||
    current === MilestoneFinanceStatus.INVOICED ||
    current === MilestoneFinanceStatus.PAYMENT_RECEIVED ||
    current === MilestoneFinanceStatus.CLOSED
  ) {
    return current;
  }
  if (achievementPct >= 100) return MilestoneFinanceStatus.ACHIEVED;
  if (achievementPct > 0) return MilestoneFinanceStatus.IN_PROGRESS;
  return MilestoneFinanceStatus.PLANNED;
}

export async function syncMilestoneBudgets(
  prisma: Db,
  financeProjectId: string,
  milestones: LegacyMilestoneInput[],
  totalBudget: number
) {
  const project = await prisma.financeProject.findUnique({ where: { id: financeProjectId } });
  if (!project) throw new Error("Finance project not found");

  const results = [];
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    const achievementPct = milestoneAchievementPct(m);
    const counts = milestoneCounts(m);
    const budgetAmount = totalBudget > 0 ? (totalBudget * m.budgetPercent) / 100 : 0;
    const existing = await prisma.projectMilestoneBudget.findUnique({
      where: {
        financeProjectId_legacyMilestoneId: {
          financeProjectId,
          legacyMilestoneId: m.id,
        },
      },
    });
    const status = deriveMilestoneStatus(achievementPct, existing?.status ?? MilestoneFinanceStatus.PLANNED);

    const row = await prisma.projectMilestoneBudget.upsert({
      where: {
        financeProjectId_legacyMilestoneId: {
          financeProjectId,
          legacyMilestoneId: m.id,
        },
      },
      create: {
        financeProjectId,
        legacyMilestoneId: m.id,
        milestoneName: m.name,
        sequence: i,
        budgetAmount,
        budgetPercent: m.budgetPercent,
        achievementPct,
        status,
        ...counts,
      },
      update: {
        milestoneName: m.name,
        sequence: i,
        budgetAmount,
        budgetPercent: m.budgetPercent,
        achievementPct,
        status,
        ...counts,
      },
    });
    results.push(row);
  }
  return results;
}

export async function getWorkflowState(prisma: PrismaClient, financeProjectId: string) {
  const project = await prisma.financeProject.findUnique({
    where: { id: financeProjectId },
    include: {
      milestoneBudgets: {
        orderBy: { sequence: "asc" },
        include: {
          utilizationCerts: {
            orderBy: { createdAt: "desc" },
            include: {
              expenseLines: { include: { expense: { select: { id: true, amount: true, status: true } } } },
              grantInvoice: { include: { payments: true } },
            },
          },
          grantInvoices: { include: { payments: true }, orderBy: { createdAt: "desc" } },
        },
      },
      budgetLines: true,
    },
  });
  if (!project) return null;

  const milestones = [];
  for (const mb of project.milestoneBudgets) {
    const spent = await prisma.expense.aggregate({
      where: { milestoneBudgetId: mb.id, status: "APPROVED" },
      _sum: { amount: true },
    });
    const pending = await prisma.expense.aggregate({
      where: { milestoneBudgetId: mb.id, status: "PENDING" },
      _sum: { amount: true },
    });
    const budget = Number(mb.budgetAmount);
    const actual = Number(spent._sum.amount ?? 0);
    const committed = Number(pending._sum.amount ?? 0);
    milestones.push({
      ...mb,
      budgetAmount: budget,
      budgetPercent: mb.budgetPercent ? Number(mb.budgetPercent) : null,
      achievementPct: Number(mb.achievementPct),
      actual,
      pending: committed,
      remaining: budget - actual - committed,
      utilizationPercent: budget > 0 ? ((actual + committed) / budget) * 100 : 0,
      utilizationCerts: mb.utilizationCerts.map((uc) => ({
        ...uc,
        totalUtilized: Number(uc.totalUtilized),
        periodStart: uc.periodStart.toISOString().slice(0, 10),
        periodEnd: uc.periodEnd.toISOString().slice(0, 10),
      })),
      grantInvoices: mb.grantInvoices.map((inv) => ({
        ...inv,
        amount: Number(inv.amount),
        invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
        payments: inv.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
          paymentDate: p.paymentDate.toISOString().slice(0, 10),
        })),
      })),
    });
  }

  return {
    project: {
      id: project.id,
      code: project.code,
      name: project.name,
      legacyProjectId: project.legacyProjectId,
      totalBudget: project.totalBudget ? Number(project.totalBudget) : null,
      donorName: project.donorName,
    },
    milestones,
  };
}

export async function createUtilizationCertificate(
  prisma: PrismaClient,
  params: {
    milestoneBudgetId: string;
    periodStart: Date;
    periodEnd: Date;
    expenseIds: string[];
    notes?: string;
    userId: string;
  }
) {
  const milestone = await prisma.projectMilestoneBudget.findUnique({
    where: { id: params.milestoneBudgetId },
  });
  if (!milestone) throw new Error("Milestone budget not found");
  if (Number(milestone.achievementPct) < 50) {
    throw new Error("Milestone achievement must be at least 50% before creating a UC");
  }

  const expenses = await prisma.expense.findMany({
    where: {
      id: { in: params.expenseIds },
      status: "APPROVED",
      financeProjectId: milestone.financeProjectId,
    },
  });
  if (expenses.length === 0) throw new Error("Select at least one approved expense");

  const totalUtilized = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const uc = await prisma.$transaction(async (tx) => {
    const created = await tx.utilizationCertificate.create({
      data: {
        milestoneBudgetId: params.milestoneBudgetId,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        totalUtilized,
        notes: params.notes,
        status: UtilizationCertificateStatus.DRAFT,
        expenseLines: {
          create: expenses.map((e) => ({
            expenseId: e.id,
            amount: e.amount,
          })),
        },
      },
    });

    await tx.expense.updateMany({
      where: { id: { in: expenses.map((e) => e.id) } },
      data: { milestoneBudgetId: params.milestoneBudgetId },
    });

    await tx.projectMilestoneBudget.update({
      where: { id: params.milestoneBudgetId },
      data: { status: MilestoneFinanceStatus.UC_DRAFT },
    });

    return created;
  });

  await logFinanceAudit(prisma, {
    action: "UC_CREATED",
    entityType: "UtilizationCertificate",
    entityId: uc.id,
    userId: params.userId,
    details: { totalUtilized, expenseCount: expenses.length },
  });

  return uc;
}

export async function submitUtilizationCertificate(
  prisma: PrismaClient,
  ucId: string,
  userId: string
) {
  const uc = await prisma.utilizationCertificate.update({
    where: { id: ucId },
    data: {
      status: UtilizationCertificateStatus.SUBMITTED,
      submittedAt: new Date(),
      submittedById: userId,
    },
    include: { milestoneBudget: true },
  });
  await prisma.projectMilestoneBudget.update({
    where: { id: uc.milestoneBudgetId },
    data: { status: MilestoneFinanceStatus.UC_SUBMITTED },
  });
  return uc;
}

export async function approveUtilizationCertificate(
  prisma: PrismaClient,
  ucId: string,
  userId: string
) {
  const uc = await prisma.utilizationCertificate.update({
    where: { id: ucId },
    data: {
      status: UtilizationCertificateStatus.APPROVED,
      approvedAt: new Date(),
      approvedById: userId,
    },
    include: { milestoneBudget: true },
  });
  await prisma.projectMilestoneBudget.update({
    where: { id: uc.milestoneBudgetId },
    data: { status: MilestoneFinanceStatus.UC_APPROVED },
  });
  return uc;
}

function nextInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const seq = String(Date.now()).slice(-6);
  return `INV/${year}/${seq}`;
}

export async function createGrantInvoiceFromUc(
  prisma: PrismaClient,
  params: {
    ucId: string;
    donorName: string;
    donorPan?: string;
    invoiceDate: Date;
    description?: string;
    userId: string;
  }
) {
  const uc = await prisma.utilizationCertificate.findUnique({
    where: { id: params.ucId },
    include: { milestoneBudget: true, grantInvoice: true },
  });
  if (!uc) throw new Error("UC not found");
  if (uc.status !== UtilizationCertificateStatus.APPROVED) {
    throw new Error("UC must be approved before invoicing");
  }
  if (uc.grantInvoice) throw new Error("Invoice already exists for this UC");

  const invoice = await prisma.grantInvoice.create({
    data: {
      financeProjectId: uc.milestoneBudget.financeProjectId,
      milestoneBudgetId: uc.milestoneBudgetId,
      ucId: uc.id,
      invoiceNumber: nextInvoiceNumber(),
      invoiceDate: params.invoiceDate,
      amount: uc.totalUtilized,
      donorName: params.donorName,
      donorPan: params.donorPan,
      description: params.description ?? `Grant claim — ${uc.milestoneBudget.milestoneName}`,
      status: GrantInvoiceStatus.SENT,
      createdById: params.userId,
    },
  });

  await prisma.projectMilestoneBudget.update({
    where: { id: uc.milestoneBudgetId },
    data: { status: MilestoneFinanceStatus.INVOICED },
  });

  await logFinanceAudit(prisma, {
    action: "GRANT_INVOICE_CREATED",
    entityType: "GrantInvoice",
    entityId: invoice.id,
    userId: params.userId,
    details: { invoiceNumber: invoice.invoiceNumber, amount: Number(invoice.amount) },
  });

  return invoice;
}

export async function recordGrantPayment(
  prisma: PrismaClient,
  params: {
    invoiceId: string;
    paymentDate: Date;
    amount: number;
    paymentMode?: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "CARD";
    reference?: string;
    userId: string;
  }
) {
  const invoice = await prisma.grantInvoice.findUnique({
    where: { id: params.invoiceId },
    include: { payments: true, milestoneBudget: true },
  });
  if (!invoice) throw new Error("Invoice not found");

  const paidSoFar = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  const invoiceAmount = Number(invoice.amount);
  if (paidSoFar + params.amount > invoiceAmount + 0.01) {
    throw new Error("Payment exceeds invoice balance");
  }

  await ensureAccountingSetup(prisma);

  const payment = await prisma.grantPayment.create({
    data: {
      invoiceId: params.invoiceId,
      paymentDate: params.paymentDate,
      amount: params.amount,
      paymentMode: params.paymentMode ?? "BANK_TRANSFER",
      reference: params.reference,
      recordedById: params.userId,
    },
  });

  const entry = await postJournalEntry(prisma, {
    entryDate: params.paymentDate,
    description: `Grant received — ${invoice.invoiceNumber} (${invoice.donorName})`,
    sourceType: "GRANT_PAYMENT",
    sourceId: payment.id,
    createdById: params.userId,
    lines: [
      { accountCode: "1000", debit: params.amount, financeProjectId: invoice.financeProjectId },
      {
        accountCode: invoice.milestoneBudget?.budgetPercent && Number(invoice.milestoneBudget.budgetPercent) > 0 ? "4100" : "4000",
        credit: params.amount,
        financeProjectId: invoice.financeProjectId,
      },
    ],
  });

  await prisma.grantPayment.update({
    where: { id: payment.id },
    data: { journalEntryId: entry.id },
  });

  const newPaid = paidSoFar + params.amount;
  const invoiceStatus =
    newPaid >= invoiceAmount - 0.01 ? GrantInvoiceStatus.PAID : GrantInvoiceStatus.PARTIALLY_PAID;

  await prisma.grantInvoice.update({
    where: { id: invoice.id },
    data: { status: invoiceStatus },
  });

  if (invoice.milestoneBudgetId) {
    await prisma.projectMilestoneBudget.update({
      where: { id: invoice.milestoneBudgetId },
      data: {
        status:
          invoiceStatus === GrantInvoiceStatus.PAID
            ? MilestoneFinanceStatus.PAYMENT_RECEIVED
            : MilestoneFinanceStatus.INVOICED,
      },
    });
  }

  await logFinanceAudit(prisma, {
    action: "GRANT_PAYMENT_RECORDED",
    entityType: "GrantPayment",
    entityId: payment.id,
    userId: params.userId,
    details: { voucherNumber: entry.voucherNumber, amount: params.amount },
  });

  return { payment, entry };
}

export async function getMilestoneBudgetVsActual(prisma: PrismaClient, financeProjectId?: string) {
  const milestones = await prisma.projectMilestoneBudget.findMany({
    where: financeProjectId ? { financeProjectId } : undefined,
    include: { financeProject: { select: { code: true, name: true } } },
    orderBy: [{ financeProjectId: "asc" }, { sequence: "asc" }],
  });

  const results = [];
  for (const mb of milestones) {
    const [spent, pending, received] = await Promise.all([
      prisma.expense.aggregate({
        where: { milestoneBudgetId: mb.id, status: "APPROVED" },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { milestoneBudgetId: mb.id, status: "PENDING" },
        _sum: { amount: true },
      }),
      prisma.grantPayment.aggregate({
        where: { invoice: { milestoneBudgetId: mb.id } },
        _sum: { amount: true },
      }),
    ]);

    const budget = Number(mb.budgetAmount);
    const actual = Number(spent._sum.amount ?? 0);
    const committed = Number(pending._sum.amount ?? 0);
    const income = Number(received._sum.amount ?? 0);

    results.push({
      projectId: mb.financeProjectId,
      projectCode: mb.financeProject.code,
      projectName: mb.financeProject.name,
      milestoneId: mb.id,
      milestoneName: mb.milestoneName,
      status: mb.status,
      achievementPct: Number(mb.achievementPct),
      budget,
      actual,
      pending: committed,
      remaining: budget - actual - committed,
      grantReceived: income,
      utilizationPercent: budget > 0 ? ((actual + committed) / budget) * 100 : 0,
    });
  }

  return results;
}
