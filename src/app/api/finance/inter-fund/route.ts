import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ensureAccountingSetup, postInterFundTransfer } from "@/lib/accounting";
import { parseDateOnly } from "@/lib/hr-utils";

const schema = z.object({
  entryDate: z.string(),
  fromFundId: z.string(),
  toFundId: z.string(),
  amount: z.number().positive(),
  bankAccountCode: z.string().optional(),
  description: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transfer" }, { status: 400 });
  }

  await ensureAccountingSetup(prisma);
  try {
    const entry = await postInterFundTransfer(prisma, {
      entryDate: parseDateOnly(parsed.data.entryDate),
      fromFundId: parsed.data.fromFundId,
      toFundId: parsed.data.toFundId,
      amount: parsed.data.amount,
      bankAccountCode: parsed.data.bankAccountCode,
      description: parsed.data.description,
      createdById: user.id,
    });
    return NextResponse.json({ entry: { id: entry.id, voucherNumber: entry.voucherNumber } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfer failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
