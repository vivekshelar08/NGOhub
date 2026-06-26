"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/finance-utils";

interface PayrollRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalNet: number;
  employeeCount: number;
  journalEntry: { id: string; voucherNumber: string; entryDate: string } | null;
  createdBy: { name: string };
}

export function PayrollJournalsPanel() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/finance/payroll-journals");
    if (res.ok) {
      const d = await res.json();
      setRuns(d.runs ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading payroll journals…</p>;
  }

  if (runs.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No paid payroll runs with GL journals yet. Journals are created when payroll is marked paid.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <Card key={run.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                {run.periodStart} — {run.periodEnd}
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                {run.employeeCount} employees · processed by {run.createdBy.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-brand-ink">
                {formatCurrency(run.totalNet)}
              </p>
              {run.journalEntry && (
                <p className="mt-1 font-mono text-sm text-brand-teal">
                  GL {run.journalEntry.voucherNumber}
                </p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
