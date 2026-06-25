import { ComplianceStatus, ComplianceType } from "@/generated/prisma/enums";

export const COMPLIANCE_TYPE_LABELS: Record<ComplianceType, string> = {
  FCRA_FC4: "FCRA Annual Return (FC-4)",
  SECTION_80G: "Section 80G renewal",
  SECTION_12A: "Section 12A renewal",
  NGO_DARPAN: "NGO Darpan update",
  CSR_UC: "CSR utilization certificate",
  STATUTORY_AUDIT: "Statutory audit",
  ITR: "Income tax return",
  FORM_10BD: "Form 10BD — annual donation statement",
  FORM_112: "Form 112 — NPO audit report",
  OTHER: "Other compliance",
};

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  UPCOMING: "Upcoming",
  DUE: "Due soon",
  FILED: "Filed",
  OVERDUE: "Overdue",
};

export function deriveComplianceStatus(dueDate: Date, filedAt: Date | null): ComplianceStatus {
  if (filedAt) return "FILED";
  const now = new Date();
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  if (now > due) return "OVERDUE";
  const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 30) return "DUE";
  return "UPCOMING";
}

/** Default India NGO compliance dates for current FY — seed once if empty. */
export function defaultComplianceSeed(year: number) {
  return [
    {
      type: "FCRA_FC4" as ComplianceType,
      title: `FCRA FC-4 — ${year}`,
      description: "Annual return to Ministry of Home Affairs for foreign contributions",
      dueDate: `${year}-12-31`,
      reminderDays: 60,
    },
    {
      type: "SECTION_80G" as ComplianceType,
      title: `80G certificate check — FY ${year}-${year + 1}`,
      description: "Verify 80G registration validity for donation receipts",
      dueDate: `${year + 1}-03-31`,
      reminderDays: 45,
    },
    {
      type: "SECTION_12A" as ComplianceType,
      title: `12A registration check — FY ${year}-${year + 1}`,
      description: "Verify 12A tax exemption registration",
      dueDate: `${year + 1}-03-31`,
      reminderDays: 45,
    },
    {
      type: "NGO_DARPAN" as ComplianceType,
      title: `NGO Darpan annual update — ${year}`,
      description: "NITI Aayog NGO Darpan portal annual profile update",
      dueDate: `${year}-06-30`,
      reminderDays: 30,
    },
    {
      type: "STATUTORY_AUDIT" as ComplianceType,
      title: `Statutory audit report — FY ${year - 1}-${year}`,
      description: "Annual audit report for board and donors",
      dueDate: `${year}-09-30`,
      reminderDays: 45,
    },
    {
      type: "ITR" as ComplianceType,
      title: `ITR filing — FY ${year - 1}-${year}`,
      description: "Income tax return for trust/Section 8 company",
      dueDate: `${year}-10-31`,
      reminderDays: 30,
    },
    {
      type: "FORM_10BD" as ComplianceType,
      title: `Form 10BD — FY ${year - 1}-${year}`,
      description: "Annual statement of donations for 80G compliance",
      dueDate: `${year}-05-31`,
      reminderDays: 30,
    },
    {
      type: "FORM_112" as ComplianceType,
      title: `Form 112 audit report — FY ${year - 1}-${year}`,
      description: "NPO audit report (replaces Form 10B/10BB from FY 2026-27)",
      dueDate: `${year}-09-30`,
      reminderDays: 45,
    },
  ];
}
