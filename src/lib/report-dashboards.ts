export type DashboardViewId = "impact" | "beneficiaries" | "operations" | "donor";

export interface DashboardViewDefinition {
  id: DashboardViewId;
  label: string;
  description: string;
}

export const DASHBOARD_VIEWS: DashboardViewDefinition[] = [
  {
    id: "impact",
    label: "Impact Overview",
    description: "Cross-module KPIs — beneficiaries, activities, meetings, and progress",
  },
  {
    id: "beneficiaries",
    label: "Beneficiary Analytics",
    description: "Category mix, urgent cases, and service enrollment",
  },
  {
    id: "operations",
    label: "Field Operations",
    description: "Activity status, work types, and calendar pipeline",
  },
  {
    id: "donor",
    label: "Donor Pack",
    description: "Achievement progress and outcome metrics for grant reporting",
  },
];

export const CHART_COLORS = [
  "#10b981",
  "#6366f1",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#64748b",
];
