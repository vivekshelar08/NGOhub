import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { expenseSchema, expenseActionSchema } from "@/lib/validators";
import { parseDateOnly, decimalToNumber } from "@/lib/hr-utils";
import { monthDateRange } from "@/lib/finance-utils";
import {
  checkBudgetEncumbrance,
  resolveFinanceProjectId,
  resolveFundId,
} from "@/lib/finance-meta";
import { ensureAccountingSetup, postExpenseJournal } from "@/lib/accounting";

const expenseInclude = {
  submittedBy: { select: { id: true, name: true, department: true } },
  reviewedBy: { select: { id: true, name: true } },
  attachments: true,
  fund: { select: { id: true, code: true, name: true } },
  financeProject: { select: { id: true, code: true, name: true } },
  journalEntry: { select: { id: true, voucherNumber: true, status: true } },
} as const;

function serializeExpense(
  expense: {
    id: string;
    category: string;
    paymentType: string;
    amount: { toString(): string };
    expenseDate: Date;
    description: string | null;
    conveyanceFrom: string | null;
    conveyanceTo: string | null;
    conveyanceKm: { toString(): string } | null;
    status: string;
    reviewNotes: string | null;
    reviewedAt: Date | null;
    projectId: string | null;
    budgetHead: string | null;
    fundType: string | null;
    fundId: string | null;
    financeProjectId: string | null;
    createdAt: Date;
    submittedBy: { id: string; name: string; department: string | null };
    reviewedBy: { id: string; name: string } | null;
    fund: { id: string; code: string; name: string } | null;
    financeProject: { id: string; code: string; name: string } | null;
    journalEntry: { id: string; voucherNumber: string; status: string } | null;
    attachments: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      dataUrl: string;
      uploadedAt: Date;
    }>;
  }
) {
  return {
    id: expense.id,
    category: expense.category,
    paymentType: expense.paymentType,
    amount: decimalToNumber(expense.amount)!,
    expenseDate: expense.expenseDate.toISOString().slice(0, 10),
    description: expense.description,
    conveyanceFrom: expense.conveyanceFrom,
    conveyanceTo: expense.conveyanceTo,
    conveyanceKm: decimalToNumber(expense.conveyanceKm),
    status: expense.status,
    reviewNotes: expense.reviewNotes,
    reviewedAt: expense.reviewedAt?.toISOString() ?? null,
    projectId: expense.projectId,
    budgetHead: expense.budgetHead,
    fundType: expense.fundType,
    fundId: expense.fundId,
    financeProjectId: expense.financeProjectId,
    fund: expense.fund,
    financeProject: expense.financeProject,
    journalEntry: expense.journalEntry,
    createdAt: expense.createdAt.toISOString(),
    submittedBy: expense.submittedBy,
    reviewedBy: expense.reviewedBy,
    attachments: expense.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      dataUrl: a.dataUrl,
      uploadedAt: a.uploadedAt.toISOString(),
    })),
  };
}

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasFeature(currentUser.role, "finance.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const viewAll = searchParams.get("all") === "1" && hasFeature(currentUser.role, "finance.approve");
    const month = searchParams.get("month");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const projectId = searchParams.get("projectId");
    const financeProjectId = searchParams.get("financeProjectId");

    const where: Record<string, unknown> = {};
    if (!viewAll) where.submittedById = currentUser.id;
    if (month) {
      const { start, end } = monthDateRange(month);
      where.expenseDate = { gte: start, lte: end };
    }
    if (category) where.category = category;
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;
    if (financeProjectId) where.financeProjectId = financeProjectId;

    const expenses = await prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    });

    return NextResponse.json({ expenses: expenses.map(serializeExpense) });
  } catch (error) {
    console.error("GET /api/finance/expenses failed:", error);
    return NextResponse.json({ error: "Failed to load expenses." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasFeature(currentUser.role, "finance.submit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = expenseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const expenseDate = parseDateOnly(parsed.data.expenseDate);
    if (parsed.data.category === "TRAVEL") {
      if (!parsed.data.conveyanceFrom?.trim() || !parsed.data.conveyanceTo?.trim()) {
        return NextResponse.json(
          { error: "Travel expenses require From and To locations" },
          { status: 400 }
        );
      }
    }

    const fundId = await resolveFundId(prisma, {
      fundId: parsed.data.fundId,
      fundType: parsed.data.fundType,
    });
    const financeProjectId = await resolveFinanceProjectId(prisma, {
      financeProjectId: parsed.data.financeProjectId,
      projectId: parsed.data.projectId,
    });

    const budgetCheck = await checkBudgetEncumbrance(prisma, {
      financeProjectId,
      budgetHead: parsed.data.budgetHead,
      amount: parsed.data.amount,
    });
    if (!budgetCheck.ok) {
      return NextResponse.json({ error: budgetCheck.message }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        submittedById: currentUser.id,
        category: parsed.data.category,
        paymentType: parsed.data.paymentType,
        amount: parsed.data.amount,
        expenseDate,
        description: parsed.data.description,
        conveyanceFrom: parsed.data.conveyanceFrom,
        conveyanceTo: parsed.data.conveyanceTo,
        conveyanceKm: parsed.data.conveyanceKm,
        projectId: parsed.data.projectId,
        budgetHead: parsed.data.budgetHead,
        fundType: parsed.data.fundType,
        fundId,
        financeProjectId,
        attachments: {
          create: parsed.data.attachments.map((a) => ({
            fileName: a.fileName,
            mimeType: a.mimeType,
            dataUrl: a.dataUrl,
          })),
        },
      },
      include: expenseInclude,
    });

    return NextResponse.json({ expense: serializeExpense(expense) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/finance/expenses failed:", error);
    return NextResponse.json({ error: "Failed to save expense." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "finance.approve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...actionBody } = body as { id?: string };
  if (!id) return NextResponse.json({ error: "Expense id required" }, { status: 400 });

  const parsed = expenseActionSchema.safeParse(actionBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense || expense.status !== "PENDING") {
    return NextResponse.json({ error: "Expense not found or already processed" }, { status: 404 });
  }

  if (parsed.data.action === "approve") {
    const financeProjectId =
      expense.financeProjectId ??
      (await resolveFinanceProjectId(prisma, { projectId: expense.projectId }));
    const budgetCheck = await checkBudgetEncumbrance(prisma, {
      financeProjectId,
      budgetHead: expense.budgetHead,
      amount: Number(expense.amount),
    });
    if (!budgetCheck.ok) {
      return NextResponse.json({ error: budgetCheck.message }, { status: 400 });
    }
  }

  let journalWarning: string | undefined;
  const updated = await prisma.expense.update({
    where: { id },
    data: {
      status: parsed.data.action === "approve" ? "APPROVED" : "REJECTED",
      reviewedById: currentUser.id,
      reviewedAt: new Date(),
      reviewNotes: parsed.data.reviewNotes,
    },
    include: expenseInclude,
  });

  if (parsed.data.action === "approve") {
    try {
      await ensureAccountingSetup(prisma);
      const entry = await postExpenseJournal(prisma, id, currentUser.id);
      if (!entry) {
        journalWarning = "Expense approved but journal was not posted (may already exist).";
      }
    } catch (error) {
      journalWarning =
        error instanceof Error ? `GL posting failed: ${error.message}` : "GL posting failed.";
      console.error("Expense journal posting failed:", error);
    }
  }

  const refreshed = await prisma.expense.findUnique({
    where: { id },
    include: expenseInclude,
  });

  return NextResponse.json({
    expense: serializeExpense(refreshed ?? updated),
    journalWarning,
  });
}
