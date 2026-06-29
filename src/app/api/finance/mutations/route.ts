import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  cancelVendorBill,
  deletePendingExpense,
  voidApprovedExpense,
  voidDonation,
} from "@/lib/finance-mutations";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete_expense"), expenseId: z.string() }),
  z.object({
    action: z.literal("void_expense"),
    expenseId: z.string(),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal("void_donation"),
    donationId: z.string(),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal("cancel_vendor_bill"),
    billId: z.string(),
    reason: z.string().optional(),
  }),
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "modify_finance_records")) {
    return forbidden();
  }

  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    switch (parsed.data.action) {
      case "delete_expense":
        await deletePendingExpense(prisma, parsed.data.expenseId, user.id);
        return NextResponse.json({ ok: true, message: "Expense deleted" });
      case "void_expense": {
        const expense = await voidApprovedExpense(
          prisma,
          parsed.data.expenseId,
          user.id,
          parsed.data.reason
        );
        return NextResponse.json({ ok: true, expense: { id: expense.id, status: expense.status } });
      }
      case "void_donation":
        await voidDonation(prisma, parsed.data.donationId, user.id, parsed.data.reason);
        return NextResponse.json({ ok: true, message: "Donation voided" });
      case "cancel_vendor_bill": {
        const bill = await cancelVendorBill(
          prisma,
          parsed.data.billId,
          user.id,
          parsed.data.reason
        );
        return NextResponse.json({ ok: true, bill: { id: bill.id, status: bill.status } });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
