import { ProjectProposal, computeBudgetTotals, formatINR, budgetAdminInputFromProject } from "@/lib/projects";

export interface BudgetVsActualRow {
  head: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  status: "ok" | "warning" | "over";
}

export interface ProjectBudgetSummary {
  projectId: string;
  projectTitle: string;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  percentUsed: number;
  rows: BudgetVsActualRow[];
}

export interface ExpenseForBudget {
  projectId: string | null;
  budgetHead: string | null;
  amount: number;
  status: string;
}

export function computeProjectBudgetSummary(
  project: ProjectProposal,
  expenses: ExpenseForBudget[]
): ProjectBudgetSummary {
  const totals = computeBudgetTotals(project.budget ?? [], budgetAdminInputFromProject(project));
  const totalBudget = totals.totalEvaluation;

  const approved = expenses.filter(
    (e) => e.projectId === project.id && (e.status === "APPROVED" || e.status === "PENDING")
  );

  const headBudget = new Map<string, number>();
  for (const cat of project.budget ?? []) {
    const catTotal = cat.items.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.duration || 0) * (item.amount || 0),
      0
    );
    headBudget.set(cat.title || "Uncategorized", (headBudget.get(cat.title || "Uncategorized") ?? 0) + catTotal);
  }

  const headSpent = new Map<string, number>();
  let unassignedSpent = 0;
  for (const e of approved) {
    if (e.budgetHead) {
      headSpent.set(e.budgetHead, (headSpent.get(e.budgetHead) ?? 0) + e.amount);
    } else {
      unassignedSpent += e.amount;
    }
  }

  const allHeads = new Set([...headBudget.keys(), ...headSpent.keys()]);
  const rows: BudgetVsActualRow[] = [];

  for (const head of allHeads) {
    const budgeted = headBudget.get(head) ?? 0;
    const spent = headSpent.get(head) ?? 0;
    const remaining = budgeted - spent;
    const percentUsed = budgeted > 0 ? (spent / budgeted) * 100 : spent > 0 ? 100 : 0;
    rows.push({
      head,
      budgeted,
      spent,
      remaining,
      percentUsed,
      status: percentUsed > 100 ? "over" : percentUsed >= 80 ? "warning" : "ok",
    });
  }

  if (unassignedSpent > 0) {
    rows.push({
      head: "(Unassigned to budget head)",
      budgeted: 0,
      spent: unassignedSpent,
      remaining: -unassignedSpent,
      percentUsed: 100,
      status: "warning",
    });
  }

  const totalSpent = approved.reduce((s, e) => s + e.amount, 0);
  const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return {
    projectId: project.id,
    projectTitle: project.title,
    totalBudget,
    totalSpent,
    totalRemaining: totalBudget - totalSpent,
    percentUsed,
    rows: rows.sort((a, b) => b.spent - a.spent),
  };
}

export function formatBudgetCurrency(n: number) {
  return `₹${formatINR(n)}`;
}

export type MeRagStatus = "on_track" | "at_risk" | "behind" | "no_data";

export interface MeIndicatorRow {
  milestoneName: string;
  kpiName: string;
  baseline: number;
  target: number;
  actual: number;
  percentAchieved: number;
  status: MeRagStatus;
}

export function computeMeSnapshot(project: ProjectProposal): MeIndicatorRow[] {
  const rows: MeIndicatorRow[] = [];
  const setup = project.setup;
  if (!setup?.milestones?.length) return rows;

  for (const m of setup.milestones) {
    for (const kpi of m.kpis ?? []) {
      const target = kpi.beneficiaryCount || kpi.activityCount || 0;
      const actual = kpi.achievedBeneficiaries ?? kpi.achievedActivityCount ?? 0;
      const baseline = 0;
      const range = target - baseline;
      const progress = range > 0 ? (actual / range) * 100 : target === 0 ? 0 : 100;
      let status: MeRagStatus = "no_data";
      if (target > 0) {
        if (progress >= 75) status = "on_track";
        else if (progress >= 40) status = "at_risk";
        else status = "behind";
      }
      rows.push({
        milestoneName: m.name,
        kpiName: kpi.name,
        baseline,
        target,
        actual,
        percentAchieved: Math.min(100, Math.max(0, progress)),
        status,
      });
    }
  }
  return rows;
}

export const RAG_LABELS: Record<MeRagStatus, string> = {
  on_track: "On track",
  at_risk: "At risk",
  behind: "Behind",
  no_data: "No data",
};

export const RAG_STYLES: Record<MeRagStatus, string> = {
  on_track: "bg-emerald-100 text-emerald-800",
  at_risk: "bg-amber-100 text-amber-800",
  behind: "bg-red-100 text-red-800",
  no_data: "bg-slate-100 text-slate-600",
};
