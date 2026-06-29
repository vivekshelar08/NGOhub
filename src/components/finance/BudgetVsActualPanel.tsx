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

interface MilestoneRow {
  projectCode: string;
  projectName: string;
  milestoneName: string;
  status: string;
  achievementPct: number;
  budget: number;
  actual: number;
  pending: number;
  remaining: number;
  grantReceived: number;
  utilizationPercent: number;
}

export function BudgetVsActualPanel() {
  const [data, setData] = useState<ProjectReport[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [headRes, msRes] = await Promise.all([
      fetch("/api/finance/budget-vs-actual"),
      fetch("/api/finance/budget-vs-actual?view=milestones"),
    ]);
    if (headRes.ok) {
      const d = await headRes.json();
      setData(d.data ?? []);
    }
    if (msRes.ok) {
      const d = await msRes.json();
      setMilestones(d.milestones ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading budget vs actual…</p>;
  }

  return (
    <div className="space-y-6">
      {milestones.length > 0 && (
        <Card>
          <CardTitle className="mb-3 text-base">By milestone (grant workflow)</CardTitle>
          <p className="mb-3 text-sm text-slate-500">
            Tied to program delivery, UC, and grant payments — use Grant workflow tab to sync
            milestones first.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 pr-3">Project</th>
                  <th className="py-2 pr-3">Milestone</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">M&E %</th>
                  <th className="py-2 pr-3 text-right">Budget</th>
                  <th className="py-2 pr-3 text-right">Spent</th>
                  <th className="py-2 pr-3 text-right">Pending</th>
                  <th className="py-2 pr-3 text-right">Grant in</th>
                  <th className="py-2 text-right">Used %</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={`${m.projectCode}-${m.milestoneName}`} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-mono text-xs">{m.projectCode}</td>
                    <td className="py-2 pr-3">{m.milestoneName}</td>
                    <td className="py-2 pr-3 text-xs">{m.status.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-3 text-right">{m.achievementPct.toFixed(0)}%</td>
                    <td className="py-2 pr-3 text-right">{formatCurrency(m.budget)}</td>
                    <td className="py-2 pr-3 text-right">{formatCurrency(m.actual)}</td>
                    <td className="py-2 pr-3 text-right">{formatCurrency(m.pending)}</td>
                    <td className="py-2 pr-3 text-right">{formatCurrency(m.grantReceived)}</td>
                    <td className="py-2 text-right">{m.utilizationPercent.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data.length === 0 && milestones.length === 0 ? (
        <p className="text-sm text-slate-500">
          No project budgets found. Create a finance project, link it to a program, and sync
          milestones under Grant workflow.
        </p>
      ) : (
        data.map((project) => (
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
        ))
      )}
    </div>
  );
}
