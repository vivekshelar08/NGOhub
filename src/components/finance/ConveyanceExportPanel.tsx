"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Label } from "@/components/ui/Input";
import { exportLocalConveyanceSheet } from "@/lib/conveyanceExport";
import { monthKey, monthLabel } from "@/lib/finance-utils";
import { ExpenseRecord } from "@/components/finance/ExpenseList";

interface ConveyanceExportPanelProps {
  userName: string;
  canViewAll: boolean;
}

export function ConveyanceExportPanel({ userName, canViewAll }: ConveyanceExportPanelProps) {
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      month: selectedMonth,
      category: "TRAVEL",
    });
    if (canViewAll) params.set("all", "1");

    const res = await fetch(`/api/finance/expenses?${params}`);
    if (res.ok) {
      const data = await res.json();
      setExpenses(data.expenses ?? []);
    }
    setLoading(false);
  }, [selectedMonth, canViewAll]);

  useEffect(() => {
    load();
  }, [load]);

  const travelTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  function handleExport() {
    exportLocalConveyanceSheet(
      expenses.map((e) => ({
        expenseDate: e.expenseDate,
        employeeName: e.submittedBy.name,
        department: e.submittedBy.department,
        description: e.description,
        conveyanceFrom: e.conveyanceFrom,
        conveyanceTo: e.conveyanceTo,
        conveyanceKm: e.conveyanceKm,
        amount: e.amount,
        paymentType: e.paymentType,
        status: e.status,
      })),
      selectedMonth,
      canViewAll ? undefined : userName
    );
  }

  return (
    <Card>
      <CardTitle className="mb-1 text-lg">Local Conveyance Export</CardTitle>
      <p className="mb-4 text-sm text-slate-500">
        At month end, export your travel expenses as a local conveyance sheet for manager approval.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <Label>Month</Label>
          <input
            type="month"
            className="input-brand"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
        <Button onClick={handleExport} disabled={expenses.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-sm font-medium text-brand-ink">
            {monthLabel(selectedMonth)} — {expenses.length} travel entries
          </p>
          <p className="mt-1 text-2xl font-bold text-brand-ink">
            ₹{travelTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {canViewAll
              ? "Showing all staff travel expenses for this month."
              : "Showing your travel expenses. Submit all entries before exporting at month end."}
          </p>
        </div>
      )}
    </Card>
  );
}
