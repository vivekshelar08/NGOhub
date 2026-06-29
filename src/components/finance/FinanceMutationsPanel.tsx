"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Label, Select } from "@/components/ui/Input";
import { ExpenseCard, ExpenseRecord } from "@/components/finance/ExpenseList";
import { formatCurrency } from "@/lib/finance-utils";

interface FinanceMutationsPanelProps {
  onFlash: (msg: string, isError?: boolean) => void;
}

export function FinanceMutationsPanel({ onFlash }: FinanceMutationsPanelProps) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [donations, setDonations] = useState<
    Array<{
      id: string;
      donorName: string;
      amount: number;
      receiptNumber: string;
      donationDate: string;
    }>
  >([]);
  const [bills, setBills] = useState<
    Array<{ id: string; billNumber: string; amount: number; status: string; vendor: { name: string } }>
  >([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const [expRes, donRes, billRes] = await Promise.all([
      fetch("/api/finance/expenses?all=1"),
      fetch("/api/donations"),
      fetch("/api/finance/vendor-bills"),
    ]);
    if (expRes.ok) {
      const data = await expRes.json();
      setExpenses(
        (data.expenses ?? []).filter(
          (e: ExpenseRecord) => e.status === "PENDING" || e.status === "APPROVED"
        )
      );
    }
    if (donRes.ok) {
      const data = await donRes.json();
      setDonations(data.donations ?? []);
    }
    if (billRes.ok) {
      const data = await billRes.json();
      setBills(
        (data.bills ?? []).filter((b: { status: string }) =>
          ["DRAFT", "APPROVED"].includes(b.status)
        )
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function mutate(body: Record<string, unknown>) {
    setLoading(true);
    const res = await fetch("/api/finance/mutations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      onFlash(data.error ?? "Action failed", true);
      return;
    }
    onFlash(data.message ?? "Done");
    load();
  }

  function confirmAction(msg: string) {
    return window.confirm(msg);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle className="mb-1 text-lg">Modify finance records</CardTitle>
        <p className="mb-4 text-sm text-slate-500">
          Admin and accountant only. Delete pending expenses, void approved expenses (reverses GL),
          void donations, or cancel vendor bills.
        </p>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold uppercase text-slate-500">Expenses</Label>
            {expenses.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No modifiable expenses.</p>
            ) : (
              <div className="mt-2 space-y-3">
                {expenses.slice(0, 15).map((expense) => (
                  <div key={expense.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 p-3">
                    <ExpenseCard expense={expense} showEmployee />
                    <div className="flex gap-2">
                      {expense.status === "PENDING" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          className="text-red-600"
                          onClick={() => {
                            if (!confirmAction("Delete this pending expense permanently?")) return;
                            mutate({ action: "delete_expense", expenseId: expense.id });
                          }}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      )}
                      {expense.status === "APPROVED" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          className="text-amber-700"
                          onClick={() => {
                            const reason = window.prompt("Reason for voiding (optional):") ?? undefined;
                            if (!confirmAction("Void this expense and reverse its journal entry?")) return;
                            mutate({ action: "void_expense", expenseId: expense.id, reason });
                          }}
                        >
                          Void
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase text-slate-500">Donations</Label>
            {donations.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No donations.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {donations.slice(0, 10).map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span>
                      {d.donorName} · {formatCurrency(d.amount)} · {d.receiptNumber}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      className="text-red-600"
                      onClick={() => {
                        if (!confirmAction(`Void donation ${d.receiptNumber}?`)) return;
                        mutate({ action: "void_donation", donationId: d.id });
                      }}
                    >
                      Void
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase text-slate-500">Vendor bills</Label>
            {bills.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No cancellable bills.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {bills.slice(0, 10).map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span>
                      {b.vendor.name} · {b.billNumber} · {formatCurrency(b.amount)} ({b.status})
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      onClick={() => {
                        if (!confirmAction(`Cancel bill ${b.billNumber}?`)) return;
                        mutate({ action: "cancel_vendor_bill", billId: b.id });
                      }}
                    >
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
