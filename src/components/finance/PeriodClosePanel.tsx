"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";

interface PeriodClosePanelProps {
  onFlash?: (msg: string, isError?: boolean) => void;
  isAdmin?: boolean;
}

export function PeriodClosePanel({ onFlash, isAdmin }: PeriodClosePanelProps) {
  const [financialYear, setFinancialYear] = useState("");
  const [periods, setPeriods] = useState<
    Array<{
      id: string;
      month: number;
      year: number;
      status: string;
      closedAt: string | null;
      closedBy: { id: string; name: string } | null;
    }>
  >([]);
  const [auditLogs, setAuditLogs] = useState<
    Array<{
      action: string;
      entityType: string;
      user: { name: string };
      createdAt: string;
    }>
  >([]);

  const flash = (m: string, e?: boolean) => onFlash?.(m, e);

  const load = useCallback(async () => {
    const res = await fetch("/api/finance/periods");
    if (res.ok) {
      const d = await res.json();
      setFinancialYear(d.financialYear);
      setPeriods(d.periods ?? []);
      setAuditLogs(d.auditLogs ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function closePeriod(periodId: string) {
    const res = await fetch("/api/finance/periods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodId, action: "close" }),
    });
    if (res.ok) {
      flash("Period closed — no further postings allowed");
      load();
    } else {
      const d = await res.json();
      flash(d.error ?? "Failed to close period", true);
    }
  }

  async function reopenPeriod(periodId: string) {
    const res = await fetch("/api/finance/periods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodId, action: "reopen" }),
    });
    if (res.ok) {
      flash("Period reopened");
      load();
    } else {
      const d = await res.json();
      flash(d.error ?? "Failed to reopen period", true);
    }
  }

  const monthName = (m: number) =>
    new Date(2000, m - 1, 1).toLocaleDateString("en-IN", { month: "long" });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Financial year: <strong>{financialYear}</strong>. Close each month after reconciliation
        and review. Closed periods block new journal postings.
        {!isAdmin && (
          <span className="mt-1 block text-xs text-slate-500">
            Only an admin can reopen closed periods.
          </span>
        )}
      </p>

      <Card>
        <CardTitle>Monthly periods</CardTitle>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {periods.map((p) => (
            <div
              key={p.id}
              className={`rounded-lg border px-3 py-2 text-sm ${
                p.status === "CLOSED" ? "border-slate-200 bg-slate-50" : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span>
                  {monthName(p.month)} {p.year}
                </span>
                {p.status === "OPEN" ? (
                  <Button size="sm" variant="outline" onClick={() => closePeriod(p.id)}>
                    Close
                  </Button>
                ) : isAdmin ? (
                  <Button size="sm" variant="outline" onClick={() => reopenPeriod(p.id)}>
                    Reopen
                  </Button>
                ) : (
                  <span className="text-xs font-medium text-slate-500">Closed</span>
                )}
              </div>
              {p.status === "CLOSED" && p.closedAt && (
                <p className="mt-1 text-xs text-slate-500">
                  Closed {new Date(p.closedAt).toLocaleString("en-IN")}
                  {p.closedBy && ` by ${p.closedBy.name}`}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Finance audit trail</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {auditLogs.map((l) => (
            <li key={l.createdAt + l.action} className="flex justify-between py-2">
              <span>
                <strong>{l.action}</strong> — {l.entityType} by {l.user.name}
              </span>
              <span className="text-slate-500">
                {new Date(l.createdAt).toLocaleString("en-IN")}
              </span>
            </li>
          ))}
          {auditLogs.length === 0 && (
            <li className="py-2 text-slate-500">No audit entries yet.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
