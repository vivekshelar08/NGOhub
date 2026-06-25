import * as XLSX from "xlsx";
import { ProjectProposal } from "@/lib/projects";
import type { ProjectBudgetSummary } from "@/lib/budgetTracking";
import type { MeIndicatorRow } from "@/lib/budgetTracking";

export interface DonorReportData {
  project: ProjectProposal;
  budget: ProjectBudgetSummary;
  meIndicators: MeIndicatorRow[];
  beneficiaryCount: number;
  servicesDelivered: number;
  periodLabel: string;
}

export function exportDonorReportPack(data: DonorReportData) {
  const wb = XLSX.utils.book_new();

  const summary = [
    ["Donor Report Pack"],
    ["Project", data.project.title],
    ["Period", data.periodLabel],
    ["Generated", new Date().toLocaleString("en-IN")],
    [],
    ["Total budget", data.budget.totalBudget],
    ["Total spent", data.budget.totalSpent],
    ["Remaining", data.budget.totalRemaining],
    ["Utilization %", Math.round(data.budget.percentUsed)],
    ["Beneficiaries", data.beneficiaryCount],
    ["Services delivered", data.servicesDelivered],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

  const budgetRows = [
    ["Budget head", "Budgeted", "Spent", "Remaining", "% used"],
    ...data.budget.rows.map((r) => [r.head, r.budgeted, r.spent, r.remaining, Math.round(r.percentUsed)]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(budgetRows), "Budget");

  if (data.meIndicators.length) {
    const meRows = [
      ["Milestone", "Indicator", "Target", "Actual", "% achieved", "Status"],
      ...data.meIndicators.map((r) => [
        r.milestoneName,
        r.kpiName,
        r.target,
        r.actual,
        Math.round(r.percentAchieved),
        r.status,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meRows), "M&E");
  }

  XLSX.writeFile(wb, `donor-report-${data.project.id.slice(0, 8)}-${Date.now()}.xlsx`);
}
