"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/finance-utils";

interface BudgetLine {
  budgetHead: string;
  fund: string | null;
  budget: number;
  actual: number;
  pending: number;
  remaining: number;
  utilizationPercent: number;
}

interface ProjectReport {
  projectId: string;
  projectCode: string;
  projectName: string;
  totalBudget: number | null;
  lines: BudgetLine[];
}

export function BudgetVsActualPanel() {
  const [data, setData] = useState<ProjectReport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/finance/budget-vs-actual");
    if (res.ok) {
      const d = await res.json();
      setData(d.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading budget vs actual…</p>;
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No project budgets found. Create finance projects with budget lines first.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {data.map((project) => (
        <Card key={project.projectId}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              <span className="font-mono text-brand-teal">{project.projectCode}</span>
              <span className="ml-2">{project.projectName}</span>
            </CardTitle>
            {project.totalBudget != null && (
              <span className="text-sm font-semibold">
                Total budget {formatCurrency(project.totalBudget)}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 pr-3">Budget head</th>
                  <th className="py-2 pr-3">Fund</th>
                  <th className="py-2 pr-3 text-right">Budget</th>
                  <th className="py-2 pr-3 text-right">Actual</th>
                  <th className="py-2 pr-3 text-right">Pending</th>
                  <th className="py-2 pr-3 text-right">Remaining</th>
                  <th className="py-2 text-right">Used %</th>
                </tr>
              </thead>
              <tbody>
                {project.lines.map((line) => {
                  const overBudget = line.utilizationPercent > 100;
                  return (
                    <tr
                      key={line.budgetHead}
                      className={`border-b border-slate-100 ${overBudget ? "bg-red-50" : ""}`}
                    >
                      <td className="py-2 pr-3">{line.budgetHead}</td>
                      <td className="py-2 pr-3 text-slate-500">{line.fund ?? "—"}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(line.budget)}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(line.actual)}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(line.pending)}</td>
                      <td
                        className={`py-2 pr-3 text-right ${line.remaining < 0 ? "font-semibold text-red-700" : ""}`}
                      >
                        {formatCurrency(line.remaining)}
                      </td>
                      <td
                        className={`py-2 text-right font-medium ${overBudget ? "text-red-700" : ""}`}
                      >
                        {line.utilizationPercent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
