import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ensureAccountingSetup } from "@/lib/accounting";

const createSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(1),
  category: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
  expenseFunction: z.enum(["PROGRAM", "ADMINISTRATIVE", "FUNDRAISING", "NONE"]).optional(),
  isFcra: z.boolean().optional(),
  parentCode: z.string().optional(),
  description: z.string().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureAccountingSetup(prisma);

  const accounts = await prisma.ledgerAccount.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
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
    return NextResponse.json({ error: "Invalid account" }, { status: 400 });
  }

  const existing = await prisma.ledgerAccount.findUnique({
    where: { code: parsed.data.code },
  });
  if (existing) {
    return NextResponse.json({ error: "Account code already exists" }, { status: 409 });
  }

  const account = await prisma.ledgerAccount.create({
    data: {
      code: parsed.data.code,
      name: parsed.data.name,
      category: parsed.data.category,
      expenseFunction: parsed.data.expenseFunction ?? "NONE",
      isFcra: parsed.data.isFcra ?? false,
      parentCode: parsed.data.parentCode,
      description: parsed.data.description,
    },
  });

  return NextResponse.json({ account }, { status: 201 });
}
