import { Role } from "@/generated/prisma/enums";
import { hasPermission, Permission } from "@/lib/rbac";

/** All platform roles in display order (highest privilege first). */
export const ALL_ROLES: Role[] = ["ADMIN", "MANAGER", "ACCOUNTANT", "HR", "COORDINATOR", "STAFF"];

export type ModuleStatus = "live" | "soon";

export type ModuleId =
  | "dashboard"
  | "projects"
  | "donors"
  | "beneficiaries"
  | "activities"
  | "calendar"
  | "finance"
  | "hr"
  | "reports"
  | "surveys"
  | "compliance"
  | "volunteers"
  | "pending"
  | "partners"
  | "assets"
  | "board"
  | "user_management"
  | "admin";

export interface AppModule {
  id: ModuleId;
  label: string;
  description: string;
  /** Main app sidebar route */
  path?: string;
  /** Admin console route (when module has an admin surface) */
  adminPath?: string;
  status: ModuleStatus;
  /** Permission required to show this module in the main sidebar */
  navPermission?: Permission;
  /** Permission required to access the admin console surface */
  adminPermission?: Permission;
}

export type FeatureId =
  // Dashboard
  | "dashboard.view"
  | "dashboard.achievements"
  | "dashboard.export"
  // Projects
  | "projects.list"
  | "projects.view"
  | "projects.create"
  | "projects.edit"
  | "projects.delete"
  | "projects.review"
  | "projects.milestone_setup"
  | "projects.milestone_reconfigure"
  | "projects.export"
  | "projects.assign_team"
  // Donors
  | "donors.list"
  | "donors.manage"
  // Beneficiaries
  | "beneficiaries.list"
  | "beneficiaries.manage"
  | "beneficiaries.export"
  // Services
  | "services.list"
  | "services.manage"
  // Field activities
  | "activities.list"
  | "activities.log"
  | "activities.assign"
  // Calendar
  | "calendar.view"
  | "calendar.request"
  | "calendar.approve"
  // Finance
  | "finance.submit"
  | "finance.approve"
  | "finance.view"
  | "finance.accounting"
  | "finance.vendors"
  | "finance.banking"
  | "finance.reports"
  | "finance.period_close"
  | "finance.compliance"
  | "finance.budget"
  // HR
  | "hr.manage"
  | "hr.attendance"
  | "hr.punch"
  | "hr.staff"
  | "hr.payroll"
  | "hr.performance"
  | "hr.enrollment"
  | "hr.salary_slip"
  | "hr.dashboard"
  // Reports
  | "reports.view"
  | "reports.export"
  // Surveys
  | "surveys.list"
  | "surveys.create"
  | "surveys.fill"
  | "surveys.results"
  | "surveys.export"
  // Pending inbox
  | "pending.view"
  // Admin console
  | "admin.access"
  | "admin.users"
  | "admin.settings"
  | "admin.logs";

export interface FeatureDefinition {
  id: FeatureId;
  moduleId: ModuleId;
  label: string;
  description: string;
  permission: Permission;
  status: ModuleStatus;
}

export const APP_MODULES: AppModule[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Organization overview, achievements, and SDG impact summary",
    path: "/dashboard",
    status: "live",
  },
  {
    id: "projects",
    label: "Projects",
    description: "Project proposals, approvals, milestones, and exports",
    path: "/dashboard/projects",
    adminPath: "/admin/projects",
    status: "live",
    navPermission: "view_projects",
    adminPermission: "manage_users",
  },
  {
    id: "donors",
    label: "Donors",
    description: "Donor registry linked to project funding",
    adminPath: "/admin/donors",
    status: "live",
    adminPermission: "manage_users",
  },
  {
    id: "beneficiaries",
    label: "Beneficiaries",
    description: "Register people, track services, and manage follow-ups",
    path: "/dashboard/beneficiaries",
    status: "live",
    navPermission: "manage_beneficiaries",
  },
  {
    id: "activities",
    label: "Field Work",
    description: "Assign tasks, log field visits, and view calendar",
    path: "/dashboard/activities",
    status: "live",
    navPermission: "field_activities",
  },
  {
    id: "finance",
    label: "Finance",
    description: "Expense submission, approvals, and local conveyance export",
    path: "/dashboard/finance",
    status: "live",
    navPermission: "view_finance",
  },
  {
    id: "hr",
    label: "My HR",
    description: "Leave, salary slips, and performance ratings",
    path: "/dashboard/hr",
    status: "live",
    navPermission: "view_attendance",
  },
  {
    id: "reports",
    label: "Reports",
    description: "Interactive analytics dashboards and exportable organization reports",
    path: "/dashboard/reports",
    status: "live",
    navPermission: "view_reports",
  },
  {
    id: "surveys",
    label: "Surveys",
    description: "Create data collection forms and capture field responses",
    path: "/dashboard/surveys",
    status: "live",
    navPermission: "fill_surveys",
  },
  {
    id: "compliance",
    label: "Compliance",
    description: "Filing deadlines, document vault, and audit readiness",
    path: "/dashboard/compliance",
    status: "live",
    navPermission: "financial_reports",
  },
  {
    id: "volunteers",
    label: "Volunteers",
    description: "Volunteer registry and hours logging",
    path: "/dashboard/volunteers",
    status: "live",
    navPermission: "field_activities",
  },
  {
    id: "pending",
    label: "Pending",
    description: "Unified inbox for approvals and follow-ups",
    path: "/dashboard/pending",
    status: "live",
    navPermission: "view_pending_inbox",
  },
  {
    id: "partners",
    label: "Partners",
    description: "Sub-grantee and implementing partner registry",
    path: "/dashboard/partners",
    status: "live",
    navPermission: "manage_projects",
  },
  {
    id: "assets",
    label: "Assets",
    description: "Equipment and procurement register",
    path: "/dashboard/assets",
    status: "live",
    navPermission: "manage_accounting",
  },
  {
    id: "board",
    label: "Board portal",
    description: "Read-only overview for trustees",
    path: "/dashboard/board",
    status: "live",
    navPermission: "view_board_portal",
  },
  {
    id: "user_management",
    label: "User Management",
    description: "Create and manage staff accounts",
    path: "/admin/users",
    status: "live",
    navPermission: "manage_users",
  },
  {
    id: "admin",
    label: "Admin Console",
    description: "Organization settings, projects, donors, and system logs",
    path: "/admin",
    adminPath: "/admin",
    status: "live",
    navPermission: "manage_users",
    adminPermission: "manage_users",
  },
];

export const FEATURES: FeatureDefinition[] = [
  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    id: "dashboard.view",
    moduleId: "dashboard",
    label: "View dashboard",
    description: "Access the main dashboard home page",
    permission: "view_attendance",
    status: "live",
  },
  {
    id: "dashboard.achievements",
    moduleId: "dashboard",
    label: "View achievements",
    description: "See SDG and impact achievement charts",
    permission: "view_attendance",
    status: "live",
  },
  {
    id: "dashboard.export",
    moduleId: "dashboard",
    label: "Export achievements",
    description: "Download achievement summaries and charts",
    permission: "view_reports",
    status: "live",
  },

  // ── Projects ───────────────────────────────────────────────────────────────
  {
    id: "projects.list",
    moduleId: "projects",
    label: "List projects",
    description: "Browse all project proposals",
    permission: "view_projects",
    status: "live",
  },
  {
    id: "projects.view",
    moduleId: "projects",
    label: "View project detail",
    description: "Open a single project proposal and its milestones",
    permission: "view_projects",
    status: "live",
  },
  {
    id: "projects.create",
    moduleId: "projects",
    label: "Create project",
    description: "Start a new project proposal wizard",
    permission: "view_projects",
    status: "live",
  },
  {
    id: "projects.edit",
    moduleId: "projects",
    label: "Edit project",
    description: "Edit draft or approved proposals (within edit limits)",
    permission: "manage_projects",
    status: "live",
  },
  {
    id: "projects.delete",
    moduleId: "projects",
    label: "Delete project",
    description: "Permanently remove a project proposal",
    permission: "manage_projects",
    status: "live",
  },
  {
    id: "projects.review",
    moduleId: "projects",
    label: "Review & approve",
    description: "Approve, reject, or send back proposals for revision",
    permission: "manage_projects",
    status: "live",
  },
  {
    id: "projects.milestone_setup",
    moduleId: "projects",
    label: "Milestone setup",
    description: "Configure milestones after proposal approval",
    permission: "manage_projects",
    status: "live",
  },
  {
    id: "projects.milestone_reconfigure",
    moduleId: "projects",
    label: "Reconfigure milestones",
    description: "Reset milestone setup on approved projects (limited attempts)",
    permission: "manage_projects",
    status: "live",
  },
  {
    id: "projects.export",
    moduleId: "projects",
    label: "Export proposal",
    description: "Download proposal documents (PDF/DOCX)",
    permission: "view_projects",
    status: "live",
  },
  {
    id: "projects.assign_team",
    moduleId: "projects",
    label: "Assign team",
    description: "Assign staff to project roles during setup",
    permission: "manage_projects",
    status: "live",
  },

  // ── Donors ─────────────────────────────────────────────────────────────────
  {
    id: "donors.list",
    moduleId: "donors",
    label: "List donors",
    description: "View donor registry",
    permission: "manage_users",
    status: "live",
  },
  {
    id: "donors.manage",
    moduleId: "donors",
    label: "Manage donors",
    description: "Create, edit, and remove donor records",
    permission: "manage_users",
    status: "live",
  },

  // ── Beneficiaries ──────────────────────────────────────────────────────────
  {
    id: "beneficiaries.list",
    moduleId: "beneficiaries",
    label: "List beneficiaries",
    description: "Browse and search beneficiary records",
    permission: "manage_beneficiaries",
    status: "live",
  },
  {
    id: "beneficiaries.manage",
    moduleId: "beneficiaries",
    label: "Manage beneficiaries",
    description: "Create and update beneficiary profiles and service deliveries",
    permission: "manage_beneficiaries",
    status: "live",
  },
  {
    id: "beneficiaries.export",
    moduleId: "beneficiaries",
    label: "Export beneficiaries",
    description: "Download beneficiary and activity-wise service status reports",
    permission: "manage_beneficiaries",
    status: "live",
  },
  {
    id: "services.list",
    moduleId: "beneficiaries",
    label: "List services",
    description: "View service catalog and delivery steps",
    permission: "manage_beneficiaries",
    status: "live",
  },
  {
    id: "services.manage",
    moduleId: "beneficiaries",
    label: "Manage services",
    description: "Create services and configure delivery steps",
    permission: "manage_projects",
    status: "live",
  },

  // ── Activities ─────────────────────────────────────────────────────────────
  {
    id: "activities.list",
    moduleId: "activities",
    label: "List activities",
    description: "View field activity history",
    permission: "field_activities",
    status: "live",
  },
  {
    id: "activities.log",
    moduleId: "activities",
    label: "Log activity",
    description: "Record a new field activity entry",
    permission: "field_activities",
    status: "live",
  },
  {
    id: "activities.assign",
    moduleId: "activities",
    label: "Assign tasks",
    description: "Map activities to staff members",
    permission: "view_projects",
    status: "live",
  },
  {
    id: "calendar.view",
    moduleId: "activities",
    label: "View calendar",
    description: "View activity calendar, holidays and festivals",
    permission: "view_attendance",
    status: "live",
  },
  {
    id: "calendar.request",
    moduleId: "activities",
    label: "Request activity",
    description: "Submit activity or task requests for approval",
    permission: "field_activities",
    status: "live",
  },
  {
    id: "calendar.approve",
    moduleId: "activities",
    label: "Approve requests",
    description: "Review and approve staff activity requests",
    permission: "view_projects",
    status: "live",
  },

  // ── Finance ────────────────────────────────────────────────────────────────
  {
    id: "finance.submit",
    moduleId: "finance",
    label: "Submit expense",
    description: "Create and submit expense claims",
    permission: "submit_expenses",
    status: "live",
  },
  {
    id: "finance.approve",
    moduleId: "finance",
    label: "Approve expense",
    description: "Review and approve submitted expenses",
    permission: "approve_expenses",
    status: "live",
  },
  {
    id: "finance.view",
    moduleId: "finance",
    label: "View finance",
    description: "View expense history and export conveyance sheets",
    permission: "view_finance",
    status: "live",
  },
  {
    id: "finance.accounting",
    moduleId: "finance",
    label: "General ledger",
    description: "Chart of accounts, journal entries, and trial balance",
    permission: "manage_accounting",
    status: "live",
  },
  {
    id: "finance.vendors",
    moduleId: "finance",
    label: "Vendors & AP",
    description: "Vendor bills, payments, and accounts payable",
    permission: "manage_vendors",
    status: "live",
  },
  {
    id: "finance.banking",
    moduleId: "finance",
    label: "Banking",
    description: "Bank accounts, statements, and reconciliation",
    permission: "bank_reconciliation",
    status: "live",
  },
  {
    id: "finance.reports",
    moduleId: "finance",
    label: "Financial reports",
    description: "P&L, balance sheet, fund-wise and functional expense reports",
    permission: "financial_reports",
    status: "live",
  },
  {
    id: "finance.period_close",
    moduleId: "finance",
    label: "Period close",
    description: "Close monthly accounting periods and lock postings",
    permission: "period_close",
    status: "live",
  },
  {
    id: "finance.compliance",
    moduleId: "finance",
    label: "Compliance exports",
    description: "Form 10BD, FC-4, and Form 112 audit prep packs",
    permission: "manage_accounting",
    status: "live",
  },
  {
    id: "finance.budget",
    moduleId: "finance",
    label: "Project budgets",
    description: "Manage project budgets and fund allocations in the ledger",
    permission: "manage_accounting",
    status: "live",
  },

  // ── HR ─────────────────────────────────────────────────────────────────────
  {
    id: "hr.manage",
    moduleId: "hr",
    label: "Manage HR",
    description: "Employee records, leave, and HR workflows",
    permission: "manage_hr",
    status: "live",
  },
  {
    id: "hr.attendance",
    moduleId: "hr",
    label: "View attendance",
    description: "View attendance records for self or team",
    permission: "view_attendance",
    status: "live",
  },
  {
    id: "hr.punch",
    moduleId: "hr",
    label: "Punch in/out",
    description: "Record daily attendance punch in and punch out",
    permission: "view_attendance",
    status: "live",
  },
  {
    id: "hr.staff",
    moduleId: "hr",
    label: "Staff directory",
    description: "Manage employee profiles and salary details",
    permission: "manage_hr",
    status: "live",
  },
  {
    id: "hr.payroll",
    moduleId: "hr",
    label: "Payroll",
    description: "Create and manage payroll runs",
    permission: "manage_hr",
    status: "live",
  },
  {
    id: "hr.performance",
    moduleId: "hr",
    label: "Performance ratings",
    description: "Submit and view staff performance reviews",
    permission: "manage_hr",
    status: "live",
  },
  {
    id: "hr.enrollment",
    moduleId: "hr",
    label: "Staff enrollment",
    description: "Generate shareable enrollment links and create logins",
    permission: "manage_hr",
    status: "live",
  },
  {
    id: "hr.dashboard",
    moduleId: "hr",
    label: "HR dashboard",
    description: "Organization-wide attendance, leave queue, and payroll control center",
    permission: "manage_hr",
    status: "live",
  },
  {
    id: "hr.salary_slip",
    moduleId: "hr",
    label: "Salary slips",
    description: "View and download personal salary slips",
    permission: "view_attendance",
    status: "live",
  },

  // ── Reports ────────────────────────────────────────────────────────────────
  {
    id: "reports.view",
    moduleId: "reports",
    label: "View reports",
    description: "Access analytics and report dashboards",
    permission: "view_reports",
    status: "live",
  },
  {
    id: "reports.export",
    moduleId: "reports",
    label: "Export reports",
    description: "Download report data and summaries",
    permission: "view_reports",
    status: "live",
  },

  // ── Surveys ────────────────────────────────────────────────────────────────
  {
    id: "surveys.list",
    moduleId: "surveys",
    label: "List surveys",
    description: "Browse published and draft surveys",
    permission: "fill_surveys",
    status: "live",
  },
  {
    id: "surveys.create",
    moduleId: "surveys",
    label: "Create survey",
    description: "Design survey questions and publish for staff",
    permission: "manage_surveys",
    status: "live",
  },
  {
    id: "surveys.fill",
    moduleId: "surveys",
    label: "Fill survey",
    description: "Submit survey responses in the field",
    permission: "fill_surveys",
    status: "live",
  },
  {
    id: "surveys.results",
    moduleId: "surveys",
    label: "View results",
    description: "Review submitted responses and analytics",
    permission: "view_survey_results",
    status: "live",
  },
  {
    id: "surveys.export",
    moduleId: "surveys",
    label: "Export responses",
    description: "Download survey response data as Excel",
    permission: "view_survey_results",
    status: "live",
  },

  // ── Pending inbox ──────────────────────────────────────────────────────────
  {
    id: "pending.view",
    moduleId: "pending",
    label: "View pending inbox",
    description: "See cross-module items awaiting your approval or action",
    permission: "view_pending_inbox",
    status: "live",
  },

  // ── Admin console ──────────────────────────────────────────────────────────
  {
    id: "admin.access",
    moduleId: "admin",
    label: "Access admin console",
    description: "Enter the admin command center",
    permission: "manage_users",
    status: "live",
  },
  {
    id: "admin.users",
    moduleId: "user_management",
    label: "User management",
    description: "Create, edit, and deactivate platform users",
    permission: "manage_users",
    status: "live",
  },
  {
    id: "admin.settings",
    moduleId: "admin",
    label: "Global settings",
    description: "Configure organization-wide system settings",
    permission: "system_settings",
    status: "soon",
  },
  {
    id: "admin.logs",
    moduleId: "admin",
    label: "System logs",
    description: "Review audit and system event logs",
    permission: "system_settings",
    status: "soon",
  },
];

const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f])) as Record<
  FeatureId,
  FeatureDefinition
>;

const MODULE_BY_ID = Object.fromEntries(APP_MODULES.map((m) => [m.id, m])) as Record<
  ModuleId,
  AppModule
>;

/** Check whether a role can use a specific feature. */
export function hasFeature(role: Role, featureId: FeatureId): boolean {
  const feature = FEATURE_BY_ID[featureId];
  return hasPermission(role, feature.permission);
}

export interface NavItemForRole {
  href: string;
  label: string;
  soon: boolean;
  exact?: boolean;
}

export interface AdminNavItemForRole extends NavItemForRole {
  featureId: FeatureId;
}

const ADMIN_NAV_ITEMS: Array<{
  href: string;
  label: string;
  featureId: FeatureId;
  exact?: boolean;
}> = [
  { href: "/admin", label: "Dashboard", featureId: "admin.access", exact: true },
  { href: "/admin/users", label: "User Management", featureId: "admin.users" },
  { href: "/admin/projects", label: "Projects", featureId: "projects.list" },
  { href: "/admin/donors", label: "Donors", featureId: "donors.list" },
  { href: "/admin/logs", label: "System Logs", featureId: "admin.logs" },
  { href: "/admin/settings", label: "Global Settings", featureId: "admin.settings" },
];

/** Sidebar sections for the admin console (order preserved). */
export const ADMIN_NAV_SECTIONS: Array<{
  title?: string;
  hrefs: string[];
}> = [
  { hrefs: ["/admin"] },
  { title: "Management", hrefs: ["/admin/users", "/admin/projects", "/admin/donors"] },
  { title: "System", hrefs: ["/admin/logs", "/admin/settings"] },
];

/** Modules visible to a role in the main app sidebar. */
export function getNavModulesForRole(role: Role): AppModule[] {
  return APP_MODULES.filter((module) => {
    if (!module.path) return false;
    if (module.id === "dashboard") return true;
    if (!module.navPermission) return false;
    return hasPermission(role, module.navPermission);
  });
}

/** Main sidebar nav entries for a role (from module registry). */
export function getNavItemsForRole(role: Role): NavItemForRole[] {
  return getNavModulesForRole(role)
    .filter((module) => role !== "HR" || module.id !== "hr")
    .filter((module) => role !== "ADMIN" || module.id !== "admin")
    .map((module) => ({
      href: module.path!,
      label:
        role === "HR" && module.id === "dashboard"
          ? "HR Dashboard"
          : module.label,
      soon: module.status === "soon",
      exact: module.id === "dashboard",
    }));
}

/** Admin console sidebar entries for a role. */
export function getAdminNavItemsForRole(role: Role): AdminNavItemForRole[] {
  return ADMIN_NAV_ITEMS.filter((item) => hasFeature(role, item.featureId)).map((item) => ({
    href: item.href,
    label: item.label,
    featureId: item.featureId,
    soon: FEATURE_BY_ID[item.featureId].status === "soon",
    exact: item.exact,
  }));
}

/** Full admin sidebar for platform admins (always includes User Management). */
export function getAdminSidebarNavItems(role: Role): AdminNavItemForRole[] {
  if (!hasPermission(role, "manage_users")) {
    return getAdminNavItemsForRole(role);
  }

  return ADMIN_NAV_ITEMS.map((item) => ({
    href: item.href,
    label: item.label,
    featureId: item.featureId,
    soon: FEATURE_BY_ID[item.featureId].status === "soon",
    exact: item.exact,
  }));
}

/** Admin console modules visible to a role. */
export function getAdminModulesForRole(role: Role): AppModule[] {
  return APP_MODULES.filter((module) => {
    if (!module.adminPath) return false;
    const permission = module.adminPermission ?? "manage_users";
    return hasPermission(role, permission);
  });
}

/** All features a role can access, grouped by module. */
export function getRoleFeatureMap(role: Role): Array<{
  module: AppModule;
  features: FeatureDefinition[];
}> {
  const featuresByModule = new Map<ModuleId, FeatureDefinition[]>();

  for (const feature of FEATURES) {
    if (!hasFeature(role, feature.id)) continue;
    const list = featuresByModule.get(feature.moduleId) ?? [];
    list.push(feature);
    featuresByModule.set(feature.moduleId, list);
  }

  return APP_MODULES.filter((module) => featuresByModule.has(module.id)).map((module) => ({
    module,
    features: featuresByModule.get(module.id)!,
  }));
}

/** Flat list of feature IDs enabled for a role. */
export function getFeaturesForRole(role: Role): FeatureId[] {
  return FEATURES.filter((f) => hasFeature(role, f.id)).map((f) => f.id);
}

/** Full role × feature matrix for reference UI or docs generation. */
export function getRoleFeatureMatrix(): Array<{
  feature: FeatureDefinition;
  module: AppModule;
  roles: Role[];
}> {
  return FEATURES.map((feature) => ({
    feature,
    module: MODULE_BY_ID[feature.moduleId],
    roles: ALL_ROLES.filter((role) => hasFeature(role, feature.id)),
  }));
}

/** Human-readable role capability summary. */
export function getRoleSummary(role: Role): {
  role: Role;
  navModules: AppModule[];
  adminModules: AppModule[];
  featureCount: number;
  featuresByModule: ReturnType<typeof getRoleFeatureMap>;
} {
  const featuresByModule = getRoleFeatureMap(role);
  return {
    role,
    navModules: getNavModulesForRole(role),
    adminModules: getAdminModulesForRole(role),
    featureCount: featuresByModule.reduce((n, g) => n + g.features.length, 0),
    featuresByModule,
  };
}
