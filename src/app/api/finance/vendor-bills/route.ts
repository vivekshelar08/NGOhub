import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { postVendorBillJournal, postVendorPaymentJournal } from "@/lib/accounting";
import { parseDateOnly } from "@/lib/hr-utils";

const createBillSchema = z.object({
  vendorId: z.string(),
  billNumber: z.string().min(1),
  billDate: z.string(),
  dueDate: z.string().optional(),
  amount: z.number().positive(),
  tdsAmount: z.number().min(0).optional(),
  gstAmount: z.number().min(0).optional(),
  description: z.string().optional(),
  ledgerAccountId: z.string().optional(),
  fundId: z.string().optional(),
  financeProjectId: z.string().optional(),
});

const createPaymentSchema = z.object({
  vendorId: z.string(),
  vendorBillId: z.string().optional(),
  paymentDate: z.string(),
  amount: z.number().positive(),
  paymentMode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD"]).optional(),
  bankAccountId: z.string().optional(),
  reference: z.string().optional(),
});

const actionSchema = z.object({
  id: z.string(),
  action: z.enum(["approve", "pay"]),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.vendors")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [bills, payments] = await Promise.all([
    prisma.vendorBill.findMany({
      orderBy: { billDate: "desc" },
      take: 100,
      include: {
        vendor: { select: { id: true, name: true } },
        ledgerAccount: { select: { code: true, name: true } },
        fund: { select: { code: true, name: true } },
      },
    }),
    prisma.vendorPayment.findMany({
      orderBy: { paymentDate: "desc" },
      take: 100,
      include: { vendor: { select: { id: true, name: true } } },
    }),
  ]);

  return NextResponse.json({
    bills: bills.map((b) => ({
      ...b,
      amount: Number(b.amount),
      tdsAmount: Number(b.tdsAmount),
      billDate: b.billDate.toISOString().slice(0, 10),
      dueDate: b.dueDate?.toISOString().slice(0, 10) ?? null,
    })),
    payments: payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      paymentDate: p.paymentDate.toISOString().slice(0, 10),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.vendors")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const type = body.type as string;

  if (type === "payment") {
    const parsed = createPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payment" }, { status: 400 });
    }
    const payment = await prisma.vendorPayment.create({
      data: {
        ...parsed.data,
        paymentDate: parseDateOnly(parsed.data.paymentDate),
        recordedById: user.id,
      },
    });
    await postVendorPaymentJournal(prisma, payment.id, user.id);
    return NextResponse.json({ payment }, { status: 201 });
  }

  const parsed = createBillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bill" }, { status: 400 });
  }

  const bill = await prisma.vendorBill.create({
    data: {
      vendorId: parsed.data.vendorId,
      billNumber: parsed.data.billNumber,
      billDate: parseDateOnly(parsed.data.billDate),
      dueDate: parsed.data.dueDate ? parseDateOnly(parsed.data.dueDate) : undefined,
      amount: parsed.data.amount,
      tdsAmount: parsed.data.tdsAmount ?? 0,
      gstAmount: parsed.data.gstAmount ?? 0,
      description: parsed.data.description,
      ledgerAccountId: parsed.data.ledgerAccountId,
      fundId: parsed.data.fundId,
      financeProjectId: parsed.data.financeProjectId,
      createdById: user.id,
    },
  });

  return NextResponse.json({ bill }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.vendors")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (parsed.data.action === "approve") {
    const bill = await prisma.vendorBill.update({
      where: { id: parsed.data.id },
      data: { status: "APPROVED" },
    });
    await postVendorBillJournal(prisma, bill.id, user.id);
    return NextResponse.json({ bill });
  }

  return NextResponse.json({ error: "Use payment type for pay action" }, { status: 400 });
}
