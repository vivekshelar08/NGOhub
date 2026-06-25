import { ExpenseCategory, ExpenseStatus, PaymentType } from "@/generated/prisma/enums";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  TRAVEL: "Travel",
  CAMP: "Camp",
  STATIONERY: "Stationery",
  OTHER: "Other",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  CARD: "Card",
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const EXPENSE_STATUS_COLORS: Record<ExpenseStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function monthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function monthLabel(monthKeyValue: string): string {
  const [y, m] = monthKeyValue.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function monthDateRange(monthKeyValue: string): { start: Date; end: Date } {
  const [y, m] = monthKeyValue.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start, end };
}
