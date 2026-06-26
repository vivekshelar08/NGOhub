import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ensureAccountingSetup } from "@/lib/accounting";
import { parseDateOnly } from "@/lib/hr-utils";

const statementLineSchema = z.object({
  transactionDate: z.string(),
  description: z.string().optional(),
  reference: z.string().optional(),
  debit: z.number().min(0).optional(),
  credit: z.number().min(0).optional(),
});

const reconcileSchema = z.object({
  bankAccountId: z.string(),
  periodEnd: z.string(),
  statementBalance: z.number(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.banking")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureAccountingSetup(prisma);

  const { searchParams } = new URL(request.url);
  const bankAccountId = searchParams.get("bankAccountId");

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { isActive: true },
    include: { ledgerAccount: { select: { code: true, name: true } } },
    orderBy: { name: "asc" },
  });

  let statementLines: Array<{
    id: string;
    transactionDate: string;
    description: string | null;
    reference: string | null;
    debit: number;
    credit: number;
    isReconciled: boolean;
  }> = [];

  if (bankAccountId) {
    const lines = await prisma.bankStatementLine.findMany({
      where: { bankAccountId },
      orderBy: { transactionDate: "desc" },
      take: 200,
    });
    statementLines = lines.map((l) => ({
      id: l.id,
      transactionDate: l.transactionDate.toISOString().slice(0, 10),
      description: l.description,
      reference: l.reference,
      debit: Number(l.debit),
      credit: Number(l.credit),
      isReconciled: l.isReconciled,
    }));
  }

  const reconciliations = bankAccountId
    ? await prisma.bankReconciliation.findMany({
        where: { bankAccountId },
        orderBy: { periodEnd: "desc" },
        take: 12,
      })
    : [];

  return NextResponse.json({
    bankAccounts: bankAccounts.map((b) => ({
      ...b,
      openingBalance: Number(b.openingBalance),
      ledgerAccount: b.ledgerAccount,
    })),
    statementLines,
    reconciliations: reconciliations.map((r) => ({
      ...r,
      statementBalance: Number(r.statementBalance),
      bookBalance: Number(r.bookBalance),
      difference: Number(r.difference),
      periodEnd: r.periodEnd.toISOString().slice(0, 10),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.banking")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const action = body.action as string;

  if (action === "reconcile") {
    const parsed = reconcileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid reconciliation" }, { status: 400 });
    }

    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: parsed.data.bankAccountId },
      include: { ledgerAccount: true },
    });
    if (!bankAccount) {
      return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
    }

    const lines = await prisma.journalLine.findMany({
      where: { ledgerAccountId: bankAccount.ledgerAccountId },
      include: { journalEntry: true },
    });
    const bookBalance =
      Number(bankAccount.openingBalance) +
      lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
    const difference = parsed.data.statementBalance - bookBalance;

    const reconciliation = await prisma.bankReconciliation.create({
      data: {
        bankAccountId: parsed.data.bankAccountId,
        periodEnd: parseDateOnly(parsed.data.periodEnd),
        statementBalance: parsed.data.statementBalance,
        bookBalance,
        difference,
        notes: parsed.data.notes,
      },
    });

    await prisma.bankStatementLine.updateMany({
      where: {
        bankAccountId: parsed.data.bankAccountId,
        transactionDate: { lte: parseDateOnly(parsed.data.periodEnd) },
        isReconciled: false,
      },
      data: { isReconciled: true, reconciledAt: new Date() },
    });

    return NextResponse.json({ reconciliation }, { status: 201 });
  }

  if (action === "post_journal") {
    const lineId = body.statementLineId as string;
    if (!lineId) return NextResponse.json({ error: "statementLineId required" }, { status: 400 });
    const { postBankStatementJournal } = await import("@/lib/accounting");
    try {
      const entry = await postBankStatementJournal(prisma, lineId, user.id);
      if (!entry) return NextResponse.json({ error: "Could not post journal" }, { status: 400 });
      return NextResponse.json({ entry: { id: entry.id, voucherNumber: entry.voucherNumber } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Post failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (action === "create_bank") {
    const { name, accountType, ledgerAccountId, accountNumber, ifsc, bankName, openingBalance } =
      body as Record<string, unknown>;
    if (!name || !ledgerAccountId) {
      return NextResponse.json({ error: "name and ledgerAccountId required" }, { status: 400 });
    }
    const bank = await prisma.bankAccount.create({
      data: {
        name: String(name),
        accountType: (accountType as "DOMESTIC" | "FCRA" | "CASH") ?? "DOMESTIC",
        ledgerAccountId: String(ledgerAccountId),
        accountNumber: accountNumber ? String(accountNumber) : undefined,
        ifsc: ifsc ? String(ifsc) : undefined,
        bankName: bankName ? String(bankName) : undefined,
        openingBalance: openingBalance ? Number(openingBalance) : 0,
      },
    });
    return NextResponse.json({ bankAccount: bank }, { status: 201 });
  }

  const parsed = statementLineSchema.safeParse(body);
  if (!parsed.success || !body.bankAccountId) {
    return NextResponse.json({ error: "Invalid statement line" }, { status: 400 });
  }

  const line = await prisma.bankStatementLine.create({
    data: {
      bankAccountId: body.bankAccountId,
      transactionDate: parseDateOnly(parsed.data.transactionDate),
      description: parsed.data.description,
      reference: parsed.data.reference,
      debit: parsed.data.debit ?? 0,
      credit: parsed.data.credit ?? 0,
    },
  });

  return NextResponse.json({ line }, { status: 201 });
}
