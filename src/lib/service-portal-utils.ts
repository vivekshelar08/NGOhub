import { BeneficiaryCategory, BeneficiaryCohort, ServiceDeliveryStatus } from "@/generated/prisma/enums";

export const DELIVERY_STATUS_LABELS: Record<ServiceDeliveryStatus, string> = {
  DATA_ENTERED: "Data Entered",
  IN_PROGRESS: "In Progress",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
};

export const DELIVERY_STATUS_COLORS: Record<ServiceDeliveryStatus, string> = {
  DATA_ENTERED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-800",
  COMPLETED: "bg-brand-mist text-brand-teal-dark",
};

export const BENEFICIARY_CATEGORY_LABELS: Record<BeneficiaryCategory, string> = {
  GENERAL: "General",
  SC: "SC",
  ST: "ST",
  OBC: "OBC",
  EWS: "EWS",
  OTHER: "Other",
};

export const BENEFICIARY_COHORT_LABELS: Record<BeneficiaryCohort, string> = {
  PWD: "Person with Disability (PwD)",
  MIGRANT: "Migrant",
  SINGLE_MOTHER: "Single Mother",
  SANITATION_WORKER: "Sanitation Worker",
  MINORITY: "Minority",
  SENIOR_CITIZEN: "Senior Citizen",
  TRANSGENDER: "Transgender",
  WIDOW: "Widow",
  ORPHAN: "Orphan",
  TRIBAL: "Tribal",
  OTHER: "Other",
};

export const BENEFICIARY_COHORT_OPTIONS = Object.entries(BENEFICIARY_COHORT_LABELS).map(
  ([value, label]) => ({ value: value as BeneficiaryCohort, label })
);

export const RECHECK_WINDOW_DAYS = 5;

export function computeRecheckDueDate(from: Date = new Date()): Date {
  const due = new Date(from);
  due.setDate(due.getDate() + RECHECK_WINDOW_DAYS);
  return due;
}

export function isRecheckOverdue(recheckDueDate: string | Date): boolean {
  return new Date(recheckDueDate) < new Date();
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `₹${amount.toLocaleString("en-IN")}`;
}
