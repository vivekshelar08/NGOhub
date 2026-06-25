import { exportSheetsToExcel, safeExportFilename } from "@/lib/excelUtils";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  formatCurrency,
  monthLabel,
  PAYMENT_TYPE_LABELS,
} from "@/lib/finance-utils";

export interface ConveyanceExpenseRow {
  expenseDate: string;
  employeeName: string;
  department: string | null;
  description: string | null;
  conveyanceFrom: string | null;
  conveyanceTo: string | null;
  conveyanceKm: number | null;
  amount: number;
  paymentType: string;
  status: string;
}

export function exportLocalConveyanceSheet(
  expenses: ConveyanceExpenseRow[],
  monthKeyValue: string,
  employeeName?: string
) {
  const label = monthLabel(monthKeyValue);
  const title = employeeName
    ? `Local Conveyance — ${employeeName} — ${label}`
    : `Local Conveyance — ${label}`;

  const rows = expenses.map((e, i) => [
    i + 1,
    e.expenseDate,
    e.description ?? "",
    e.conveyanceFrom ?? "",
    e.conveyanceTo ?? "",
    e.conveyanceKm ?? "",
    e.amount,
    PAYMENT_TYPE_LABELS[e.paymentType as keyof typeof PAYMENT_TYPE_LABELS] ?? e.paymentType,
    EXPENSE_STATUS_LABELS[e.status as keyof typeof EXPENSE_STATUS_LABELS] ?? e.status,
  ]);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  rows.push(["", "", "", "", "", "Total", total, "", ""]);

  exportSheetsToExcel(
    [
      {
        name: "Local Conveyance",
        headers: [
          "S.No",
          "Date",
          "Purpose",
          "From",
          "To",
          "Km",
          "Amount (INR)",
          "Payment Mode",
          "Status",
        ],
        rows,
      },
      {
        name: "Summary",
        headers: ["Field", "Value"],
        rows: [
          ["Report", title],
          ["Month", label],
          ["Total entries", expenses.length],
          ["Total amount", formatCurrency(total)],
        ],
      },
    ],
    safeExportFilename("local-conveyance", monthKeyValue + (employeeName ? `-${employeeName}` : ""))
  );
}

export function exportAllExpensesSheet(
  expenses: Array<{
    expenseDate: string;
    employeeName: string;
    department: string | null;
    category: string;
    description: string | null;
    amount: number;
    paymentType: string;
    status: string;
  }>,
  monthKeyValue: string
) {
  const label = monthLabel(monthKeyValue);

  exportSheetsToExcel(
    [
      {
        name: "Expenses",
        headers: [
          "Date",
          "Employee",
          "Department",
          "Category",
          "Description",
          "Amount (INR)",
          "Payment Mode",
          "Status",
        ],
        rows: expenses.map((e) => [
          e.expenseDate,
          e.employeeName,
          e.department ?? "",
          EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? e.category,
          e.description ?? "",
          e.amount,
          PAYMENT_TYPE_LABELS[e.paymentType as keyof typeof PAYMENT_TYPE_LABELS] ?? e.paymentType,
          EXPENSE_STATUS_LABELS[e.status as keyof typeof EXPENSE_STATUS_LABELS] ?? e.status,
        ]),
      },
    ],
    safeExportFilename("expenses", monthKeyValue)
  );
}
