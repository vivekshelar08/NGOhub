"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  formatCurrency,
  PAYMENT_TYPE_LABELS,
} from "@/lib/finance-utils";
import { ExpenseCategory, ExpenseStatus, PaymentType } from "@/generated/prisma/enums";

export interface ExpenseRecord {
  id: string;
  category: ExpenseCategory;
  paymentType: PaymentType;
  amount: number;
  expenseDate: string;
  description: string | null;
  conveyanceFrom: string | null;
  conveyanceTo: string | null;
  conveyanceKm: number | null;
  status: ExpenseStatus;
  reviewNotes: string | null;
  submittedBy: { id: string; name: string; department: string | null };
  attachments: Array<{ id: string; fileName: string; mimeType: string; dataUrl: string }>;
}

interface MyExpensesPanelProps {
  showEmployee?: boolean;
}

export function MyExpensesPanel({ showEmployee }: MyExpensesPanelProps) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/finance/expenses?${params}`);
    if (res.ok) {
      const data = await res.json();
      setExpenses(data.expenses ?? []);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-lg">My Expenses</CardTitle>
        <select
          className="input-brand w-auto text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading expenses…</p>
      ) : expenses.length === 0 ? (
        <p className="text-sm text-slate-500">No expenses found.</p>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <ExpenseCard key={expense.id} expense={expense} showEmployee={showEmployee} />
          ))}
        </div>
      )}
    </Card>
  );
}

export function ExpenseCard({
  expense,
  showEmployee,
  actions,
}: {
  expense: ExpenseRecord;
  showEmployee?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-brand-ink">
              {EXPENSE_CATEGORY_LABELS[expense.category]}
            </span>
            <StatusBadge
              tone={
                expense.status === "APPROVED"
                  ? "success"
                  : expense.status === "REJECTED"
                    ? "danger"
                    : "warning"
              }
            >
              {EXPENSE_STATUS_LABELS[expense.status]}
            </StatusBadge>
          </div>
          {showEmployee && (
            <p className="mt-1 text-sm text-slate-600">
              {expense.submittedBy.name}
              {expense.submittedBy.department ? ` · ${expense.submittedBy.department}` : ""}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-500">
            {expense.expenseDate} · {PAYMENT_TYPE_LABELS[expense.paymentType]}
          </p>
        </div>
        <p className="text-lg font-bold text-brand-ink">{formatCurrency(expense.amount)}</p>
      </div>

      {expense.description && (
        <p className="mt-2 text-sm text-slate-600">{expense.description}</p>
      )}

      {expense.category === "TRAVEL" && (expense.conveyanceFrom || expense.conveyanceTo) && (
        <p className="mt-2 text-sm text-slate-600">
          {expense.conveyanceFrom} → {expense.conveyanceTo}
          {expense.conveyanceKm != null ? ` · ${expense.conveyanceKm} km` : ""}
        </p>
      )}

      {expense.reviewNotes && (
        <p className="mt-2 text-sm text-red-600">Note: {expense.reviewNotes}</p>
      )}

      {expense.attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {expense.attachments.map((att) => (
            <a
              key={att.id}
              href={att.dataUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {att.mimeType.startsWith("image/") ? (
                <ExternalLink className="h-3.5 w-3.5" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-red-500" />
              )}
              {att.fileName}
            </a>
          ))}
        </div>
      )}

      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </div>
  );
}
