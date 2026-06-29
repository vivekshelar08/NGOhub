import { PrismaClient } from "@/generated/prisma/client";
import { ExpenseStatus, VendorBillStatus } from "@/generated/prisma/enums";
import { logFinanceAudit, reverseJournalEntry } from "@/lib/accounting";

export async function deletePendingExpense(prisma: PrismaClient, expenseId: string, userId: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) throw new Error("Expense not found");
  if (expense.status !== ExpenseStatus.PENDING) {
    throw new Error("Only pending expenses can be deleted");
  }
  if (expense.journalEntryId) {
    throw new Error("Expense has a journal entry — void instead");
  }

  await prisma.expense.delete({ where: { id: expenseId } });
  await logFinanceAudit(prisma, {
    action: "EXPENSE_DELETED",
    entityType: "Expense",
    entityId: expenseId,
    userId,
    details: { amount: Number(expense.amount), status: expense.status },
  });
}

export async function voidApprovedExpense(
  prisma: PrismaClient,
  expenseId: string,
  userId: string,
  reason?: string
) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) throw new Error("Expense not found");
  if (expense.status !== ExpenseStatus.APPROVED) {
    throw new Error("Only approved expenses can be voided");
  }

  if (expense.journalEntryId) {
    await reverseJournalEntry(prisma, expense.journalEntryId, userId, reason ?? "Expense voided");
    await prisma.expense.update({
      where: { id: expenseId },
      data: { journalEntryId: null },
    });
  }

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      status: ExpenseStatus.REJECTED,
      reviewNotes: reason ? `VOIDED: ${reason}` : "VOIDED by administrator",
      reviewedAt: new Date(),
      reviewedById: userId,
    },
  });

  await logFinanceAudit(prisma, {
    action: "EXPENSE_VOIDED",
    entityType: "Expense",
    entityId: expenseId,
    userId,
    details: { amount: Number(expense.amount), reason },
  });

  return updated;
}

export async function voidDonation(
  prisma: PrismaClient,
  donationId: string,
  userId: string,
  reason?: string
) {
  const donation = await prisma.donation.findUnique({ where: { id: donationId } });
  if (!donation) throw new Error("Donation not found");

  if (donation.journalEntryId) {
    await reverseJournalEntry(prisma, donation.journalEntryId, userId, reason ?? "Donation voided");
  }

  await prisma.donation.delete({ where: { id: donationId } });
  await logFinanceAudit(prisma, {
    action: "DONATION_VOIDED",
    entityType: "Donation",
    entityId: donationId,
    userId,
    details: { amount: Number(donation.amount), receiptNumber: donation.receiptNumber, reason },
  });
}

export async function cancelVendorBill(
  prisma: PrismaClient,
  billId: string,
  userId: string,
  reason?: string
) {
  const bill = await prisma.vendorBill.findUnique({ where: { id: billId } });
  if (!bill) throw new Error("Vendor bill not found");
  if (bill.status === VendorBillStatus.CANCELLED) {
    throw new Error("Bill already cancelled");
  }
  if (bill.status === VendorBillStatus.PAID) {
    throw new Error("Paid bills cannot be cancelled — reverse payment first");
  }

  if (bill.journalEntryId && bill.status === VendorBillStatus.APPROVED) {
    await reverseJournalEntry(prisma, bill.journalEntryId, userId, reason ?? "Vendor bill cancelled");
    await prisma.vendorBill.update({
      where: { id: billId },
      data: { journalEntryId: null },
    });
  }

  const updated = await prisma.vendorBill.update({
    where: { id: billId },
    data: { status: VendorBillStatus.CANCELLED, description: reason ? `${bill.description ?? ""} [CANCELLED: ${reason}]` : bill.description },
  });

  await logFinanceAudit(prisma, {
    action: "VENDOR_BILL_CANCELLED",
    entityType: "VendorBill",
    entityId: billId,
    userId,
    details: { amount: Number(bill.amount), reason },
  });

  return updated;
}
