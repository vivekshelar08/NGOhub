import { Role } from "@/generated/prisma/enums";

export type Permission =
  | "manage_users"
  | "system_settings"
  | "manage_projects"
  | "view_projects"
  | "manage_beneficiaries"
  | "approve_expenses"
  | "submit_expenses"
  | "view_finance"
  | "manage_accounting"
  | "post_journal_entries"
  | "manage_chart_of_accounts"
  | "bank_reconciliation"
  | "financial_reports"
  | "manage_vendors"
  | "period_close"
  | "manage_hr"
  | "view_attendance"
  | "view_reports"
  | "view_pending_inbox"
  | "view_board_portal"
  | "field_activities"
  | "manage_surveys"
  | "fill_surveys"
  | "view_survey_results";

const ACCOUNTING_PERMISSIONS: Permission[] = [
  "manage_accounting",
  "post_journal_entries",
  "manage_chart_of_accounts",
  "bank_reconciliation",
  "financial_reports",
  "manage_vendors",
  "period_close",
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "manage_users",
    "system_settings",
    "manage_projects",
    "view_projects",
    "manage_beneficiaries",
    "approve_expenses",
    "view_finance",
    ...ACCOUNTING_PERMISSIONS,
    "view_attendance",
    "view_reports",
    "view_pending_inbox",
    "view_board_portal",
    "field_activities",
    "manage_surveys",
    "fill_surveys",
    "view_survey_results",
  ],
  MANAGER: [
    "manage_projects",
    "view_projects",
    "manage_beneficiaries",
    "approve_expenses",
    "submit_expenses",
    "view_finance",
    "financial_reports",
    "view_attendance",
    "view_reports",
    "view_pending_inbox",
    "view_board_portal",
    "field_activities",
    "manage_surveys",
    "fill_surveys",
    "view_survey_results",
  ],
  ACCOUNTANT: [
    "view_projects",
    "submit_expenses",
    "approve_expenses",
    "view_finance",
    ...ACCOUNTING_PERMISSIONS,
    "view_attendance",
    "view_reports",
    "view_pending_inbox",
    "financial_reports",
  ],
  HR: [
    "view_projects",
    "submit_expenses",
    "view_finance",
    "manage_hr",
    "view_attendance",
    "view_pending_inbox",
  ],
  COORDINATOR: [
    "view_projects",
    "manage_beneficiaries",
    "submit_expenses",
    "view_finance",
    "view_attendance",
    "field_activities",
    "manage_surveys",
    "fill_surveys",
    "view_survey_results",
  ],
  STAFF: [
    "manage_beneficiaries",
    "submit_expenses",
    "view_finance",
    "view_attendance",
    "field_activities",
    "fill_surveys",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canManageUsers(role: Role): boolean {
  return hasPermission(role, "manage_users");
}

export function canViewPendingInbox(role: Role): boolean {
  return hasPermission(role, "view_pending_inbox");
}
