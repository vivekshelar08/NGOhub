import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ensureAccountingSetup, postJournalEntry, logFinanceAudit } from "@/lib/accounting";
import { parseDateOnly } from "@/lib/hr-utils";

const lineSchema = z.object({
  accountCode: z.string(),
  debit: z.number().min(0).optional(),
  credit: z.number().min(0).optional(),
  fundId: z.string().optional(),
  financeProjectId: z.string().optional(),
  narration: z.string().optional(),
});

const createSchema = z.object({
  entryDate: z.string(),
  description: z.string().min(1),
  status: z.enum(["DRAFT", "POSTED"]).optional(),
  lines: z.array(lineSchema).min(2),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureAccountingSetup(prisma);

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 50);

  const entries = await prisma.journalEntry.findMany({
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: Math.min(limit, 200),
    include: {
      createdBy: { select: { id: true, name: true } },
      lines: {
        include: {
          ledgerAccount: { select: { code: true, name: true } },
          fund: { select: { code: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      voucherNumber: e.voucherNumber,
      entryDate: e.entryDate.toISOString().slice(0, 10),
      description: e.description,
      sourceType: e.sourceType,
      status: e.status,
      createdBy: e.createdBy,
      lines: e.lines.map((l) => ({
        accountCode: l.ledgerAccount.code,
        accountName: l.ledgerAccount.name,
        fund: l.fund?.code ?? null,
        debit: Number(l.debit),
        credit: Number(l.credit),
        narration: l.narration,
      })),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid journal entry" }, { status: 400 });
  }

  await ensureAccountingSetup(prisma);

  try {
    const entry = await postJournalEntry(prisma, {
      entryDate: parseDateOnly(parsed.data.entryDate),
      description: parsed.data.description,
      sourceType: "MANUAL",
      createdById: user.id,
      status: parsed.data.status ?? "POSTED",
      lines: parsed.data.lines,
    });

    await logFinanceAudit(prisma, {
      action: "JOURNAL_POSTED",
      entityType: "JournalEntry",
      entityId: entry.id,
      userId: user.id,
      details: { voucherNumber: entry.voucherNumber },
    });

    return NextResponse.json({ entry: { id: entry.id, voucherNumber: entry.voucherNumber } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to post journal";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
