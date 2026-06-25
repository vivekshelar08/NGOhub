/** Operational model — controls which modules and workflows apply to a project. */
export type ProjectType =
  | "FULL_PROGRAM"
  | "CENTER_SETUP"
  | "ENROLLMENT_TRACKING"
  | "SINGLE_ACTIVITY"
  | "FIELD_OPERATIONS"
  | "SERVICE_DELIVERY"
  | "INSTITUTIONAL";

export type ProjectModule =
  | "setup"
  | "activities"
  | "services"
  | "beneficiary_status"
  | "finance";

export type SetupMode =
  | "full"
  | "phases_only"
  | "minimal"
  | "enrollment"
  | "institutional"
  | "budget_only";

/** What the setup catalog step collects before milestones/KPIs. */
export type CatalogMode =
  | "activities_beneficiaries"
  | "phases"
  | "services"
  | "enrollment"
  | "deliverables"
  | "single_event";

export type BeneficiaryMode = "none" | "aggregate" | "status_pipeline" | "full_service";

export type KpiModeOption = "activities" | "beneficiaries" | "combined";

export type SetupWizardStepId = "catalog" | "milestones" | "kpis" | "staff" | "review";

export interface ProjectTypeDefinition {
  value: ProjectType;
  label: string;
  description: string;
  enabledModules: ProjectModule[];
  setupMode: SetupMode;
  catalogMode: CatalogMode;
  beneficiaryMode: BeneficiaryMode;
  /** Ordered post-approval setup steps (every type includes milestones + KPIs). */
  setupStepIds: SetupWizardStepId[];
  allowedKpiModes: KpiModeOption[];
  requireStaffInSetup: boolean;
  /** Hide the Activities step in the proposal wizard. */
  skipActivitiesStep: boolean;
  /** Require at least one activity in the proposal (when step is shown). */
  requireActivitiesInProposal: boolean;
  /** Cap catalog / proposal activities (e.g. 1 for single-activity projects). */
  maxActivities?: number;
  /** Require a positive target beneficiary count in basics. */
  requireBeneficiaryTarget: boolean;
  /** When enrolling via Service Portal, must pick a service (false = status-only). */
  requireServiceOnEnrollment: boolean;
  /** Short hint shown in proposal wizard after type selection. */
  proposalFlowHint: string;
  /** Short hint shown at top of milestone setup wizard. */
  setupFlowHint: string;
}

export const PROJECT_TYPES: ProjectTypeDefinition[] = [
  {
    value: "FULL_PROGRAM",
    label: "Full Program",
    description: "Multi-activity program with milestones, field activities, and services",
    enabledModules: ["setup", "activities", "services", "finance"],
    setupMode: "full",
    catalogMode: "activities_beneficiaries",
    beneficiaryMode: "full_service",
    setupStepIds: ["catalog", "milestones", "kpis", "staff", "review"],
    allowedKpiModes: ["activities", "beneficiaries", "combined"],
    requireStaffInSetup: true,
    skipActivitiesStep: false,
    requireActivitiesInProposal: true,
    requireBeneficiaryTarget: true,
    requireServiceOnEnrollment: true,
    proposalFlowHint:
      "Define activities in the proposal, then split activity & beneficiary totals across milestones and KPIs after approval.",
    setupFlowHint:
      "Full setup: catalog totals → budget milestones → KPI splits → field staff assignment.",
  },
  {
    value: "CENTER_SETUP",
    label: "Center Setup",
    description: "Infrastructure or facility setup — phased delivery, no beneficiary tracking",
    enabledModules: ["setup", "finance"],
    setupMode: "phases_only",
    catalogMode: "phases",
    beneficiaryMode: "none",
    setupStepIds: ["catalog", "milestones", "kpis", "staff", "review"],
    allowedKpiModes: ["activities"],
    requireStaffInSetup: true,
    skipActivitiesStep: true,
    requireActivitiesInProposal: false,
    requireBeneficiaryTarget: false,
    requireServiceOnEnrollment: false,
    proposalFlowHint:
      "Budget-only proposal. After approval, define setup phases and track phase completion via activity KPIs.",
    setupFlowHint:
      "Phase setup: define infrastructure phases → budget milestones → activity KPIs per phase → assign coordinator.",
  },
  {
    value: "ENROLLMENT_TRACKING",
    label: "Enrollment Tracking",
    description: "Register beneficiaries and track status through milestones",
    enabledModules: ["setup", "beneficiary_status", "finance"],
    setupMode: "enrollment",
    catalogMode: "enrollment",
    beneficiaryMode: "status_pipeline",
    setupStepIds: ["catalog", "milestones", "kpis", "review"],
    allowedKpiModes: ["beneficiaries", "combined"],
    requireStaffInSetup: false,
    skipActivitiesStep: true,
    requireActivitiesInProposal: false,
    requireBeneficiaryTarget: true,
    requireServiceOnEnrollment: false,
    proposalFlowHint:
      "Set enrollment target in basics. After approval, define enrollment periods as milestones with beneficiary KPIs.",
    setupFlowHint:
      "Enrollment setup: enrollment targets → period milestones → beneficiary KPIs per period (status tracked in Service Portal).",
  },
  {
    value: "SINGLE_ACTIVITY",
    label: "Single Activity",
    description: "One camp, drive, or event with optional headcount",
    enabledModules: ["setup", "activities", "finance"],
    setupMode: "minimal",
    catalogMode: "single_event",
    beneficiaryMode: "aggregate",
    setupStepIds: ["catalog", "milestones", "kpis", "review"],
    allowedKpiModes: ["activities", "beneficiaries", "combined"],
    requireStaffInSetup: false,
    skipActivitiesStep: false,
    requireActivitiesInProposal: true,
    maxActivities: 1,
    requireBeneficiaryTarget: true,
    requireServiceOnEnrollment: false,
    proposalFlowHint:
      "One activity in the proposal. After approval, a streamlined milestone + KPI setup (no staff step).",
    setupFlowHint:
      "Quick setup: single event line → one or two milestones → KPI targets → activate.",
  },
  {
    value: "FIELD_OPERATIONS",
    label: "Field Operations",
    description: "Recurring field visits and community activities",
    enabledModules: ["setup", "activities", "finance"],
    setupMode: "full",
    catalogMode: "activities_beneficiaries",
    beneficiaryMode: "aggregate",
    setupStepIds: ["catalog", "milestones", "kpis", "staff", "review"],
    allowedKpiModes: ["activities", "beneficiaries", "combined"],
    requireStaffInSetup: true,
    skipActivitiesStep: false,
    requireActivitiesInProposal: true,
    requireBeneficiaryTarget: false,
    requireServiceOnEnrollment: false,
    proposalFlowHint:
      "List field activities (beneficiary target optional). Milestones split activity units; beneficiaries can roll up at milestone level.",
    setupFlowHint:
      "Field setup: activity catalog → visit milestones → activity/beneficiary KPIs → assign field coordinator.",
  },
  {
    value: "SERVICE_DELIVERY",
    label: "Service Delivery",
    description: "Individual beneficiary services with multi-step delivery",
    enabledModules: ["setup", "services", "finance"],
    setupMode: "full",
    catalogMode: "services",
    beneficiaryMode: "full_service",
    setupStepIds: ["catalog", "milestones", "kpis", "staff", "review"],
    allowedKpiModes: ["beneficiaries", "combined"],
    requireStaffInSetup: true,
    skipActivitiesStep: true,
    requireActivitiesInProposal: false,
    requireBeneficiaryTarget: true,
    requireServiceOnEnrollment: true,
    proposalFlowHint:
      "No activities step — define service targets in basics. After approval, catalog service lines and beneficiary KPIs per milestone.",
    setupFlowHint:
      "Service setup: service catalog lines → delivery milestones → beneficiary/combined KPIs → assign service team.",
  },
  {
    value: "INSTITUTIONAL",
    label: "Institutional",
    description: "Partner capacity building, research, or institutional deliverables",
    enabledModules: ["setup", "finance"],
    setupMode: "institutional",
    catalogMode: "deliverables",
    beneficiaryMode: "none",
    setupStepIds: ["catalog", "milestones", "kpis", "review"],
    allowedKpiModes: ["activities"],
    requireStaffInSetup: false,
    skipActivitiesStep: true,
    requireActivitiesInProposal: false,
    requireBeneficiaryTarget: false,
    requireServiceOnEnrollment: false,
    proposalFlowHint:
      "Budget-focused proposal. After approval, define deliverables and track completion via milestone activity KPIs.",
    setupFlowHint:
      "Institutional setup: deliverable catalog → reporting milestones → deliverable KPIs → activate (no field staff).",
  },
];

export function normalizeProjectType(raw: unknown): ProjectType {
  const valid = PROJECT_TYPES.map((t) => t.value);
  if (typeof raw === "string" && valid.includes(raw as ProjectType)) {
    return raw as ProjectType;
  }
  return "FULL_PROGRAM";
}

export function getProjectTypeConfig(type: ProjectType | undefined): ProjectTypeDefinition {
  return PROJECT_TYPES.find((t) => t.value === (type ?? "FULL_PROGRAM")) ?? PROJECT_TYPES[0];
}

export function formatProjectType(type: ProjectType | undefined): string {
  return getProjectTypeConfig(type).label;
}

export function projectSupportsModule(
  type: ProjectType | undefined,
  module: ProjectModule
): boolean {
  return getProjectTypeConfig(type).enabledModules.includes(module);
}

export function projectSupportsActivities(type: ProjectType | undefined): boolean {
  return projectSupportsModule(type, "activities");
}

export function projectSupportsServices(type: ProjectType | undefined): boolean {
  return projectSupportsModule(type, "services");
}

export function projectSupportsBeneficiaryStatus(type: ProjectType | undefined): boolean {
  return projectSupportsModule(type, "beneficiary_status");
}

export function projectRequiresServiceOnEnrollment(type: ProjectType | undefined): boolean {
  return getProjectTypeConfig(type).requireServiceOnEnrollment;
}

/** Every project type completes milestone + KPI setup after approval. */
export function projectRequiresSetup(type: ProjectType | undefined): boolean {
  return projectSupportsModule(type, "setup");
}

export function projectRequiresStaffInSetup(type: ProjectType | undefined): boolean {
  return getProjectTypeConfig(type).requireStaffInSetup;
}

export function getAllowedKpiModes(type: ProjectType | undefined): KpiModeOption[] {
  return getProjectTypeConfig(type).allowedKpiModes;
}

export function getSetupStepIdsForType(type: ProjectType | undefined): SetupWizardStepId[] {
  return getProjectTypeConfig(type).setupStepIds;
}

export function catalogShowsActivityCount(type: ProjectType | undefined): boolean {
  const mode = getProjectTypeConfig(type).catalogMode;
  return mode !== "enrollment";
}

export function catalogShowsBeneficiaries(type: ProjectType | undefined): boolean {
  const config = getProjectTypeConfig(type);
  if (config.catalogMode === "phases" || config.catalogMode === "deliverables") return false;
  if (config.beneficiaryMode === "none") return false;
  return true;
}

export function getCatalogStepLabel(type: ProjectType | undefined): string {
  const mode = getProjectTypeConfig(type).catalogMode;
  switch (mode) {
    case "phases":
      return "Setup Phases";
    case "services":
      return "Service Lines";
    case "enrollment":
      return "Enrollment Targets";
    case "deliverables":
      return "Deliverables";
    case "single_event":
      return "Event Totals";
    default:
      return "Activity & Beneficiary Totals";
  }
}

export function getCatalogActivityFieldLabel(type: ProjectType | undefined): string {
  const mode = getProjectTypeConfig(type).catalogMode;
  switch (mode) {
    case "phases":
      return "Phase units";
    case "deliverables":
      return "Deliverable count";
    case "services":
      return "Service sessions (optional)";
    default:
      return "Total activity count";
  }
}

export function getSetupStepLabel(stepId: SetupWizardStepId, type: ProjectType | undefined): string {
  if (stepId === "catalog") return getCatalogStepLabel(type);
  switch (stepId) {
    case "milestones":
      return getProjectTypeConfig(type).catalogMode === "deliverables"
        ? "Reporting Milestones"
        : "Milestones & Budget";
    case "kpis":
      return "Milestone KPIs";
    case "staff":
      return "Staff Assignment";
    case "review":
      return "Review & Activate";
    default:
      return stepId;
  }
}

export function getPortalEligibleProjectTypes(): ProjectType[] {
  return PROJECT_TYPES.filter(
    (t) => t.enabledModules.includes("beneficiary_status") || t.enabledModules.includes("services")
  ).map((t) => t.value);
}

/** How a project is funded — used for donor-wise, state-wise, and govt reporting. */
export type ProjectFundingType =
  | "CSR"
  | "DONATION"
  | "GOVERNMENT"
  | "GRANT"
  | "PHILANTHROPY"
  | "INTERNAL"
  | "OTHER";

export const PROJECT_FUNDING_TYPES: { value: ProjectFundingType; label: string; description: string }[] = [
  { value: "CSR", label: "CSR", description: "Corporate Social Responsibility funding" },
  { value: "DONATION", label: "Donation", description: "Individual or general donations" },
  { value: "GOVERNMENT", label: "Government", description: "Central or state government scheme / grant" },
  { value: "GRANT", label: "Grant", description: "Foundation or institutional grant" },
  { value: "PHILANTHROPY", label: "Philanthropy", description: "HNI or family philanthropy" },
  { value: "INTERNAL", label: "Internal", description: "Self-funded or internal allocation" },
  { value: "OTHER", label: "Other", description: "Other funding source" },
];

export const INDIAN_STATES_AND_UTS = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export type IndianState = (typeof INDIAN_STATES_AND_UTS)[number];

export function formatProjectFundingType(type: ProjectFundingType | undefined): string {
  if (!type) return "—";
  return PROJECT_FUNDING_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** Funding types that should be linked to at least one donor on submit. */
export function fundingTypeRequiresDonor(type: ProjectFundingType | undefined): boolean {
  return type === "CSR" || type === "DONATION" || type === "GRANT" || type === "PHILANTHROPY";
}

export function normalizeProjectFundingType(raw: unknown): ProjectFundingType {
  const valid = PROJECT_FUNDING_TYPES.map((t) => t.value);
  if (typeof raw === "string" && valid.includes(raw as ProjectFundingType)) {
    return raw as ProjectFundingType;
  }
  return "CSR";
}

export function normalizeDonorIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export function normalizeProjectState(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

export type ProjectLocationScope = "single" | "multi_district" | "multi_state";

export const PROJECT_LOCATION_SCOPES: {
  value: ProjectLocationScope;
  label: string;
  description: string;
}[] = [
  {
    value: "single",
    label: "Single location",
    description: "One state and one district",
  },
  {
    value: "multi_district",
    label: "Multi-district",
    description: "Spans multiple districts (same or different states)",
  },
  {
    value: "multi_state",
    label: "Multi-state",
    description: "Spans multiple states or union territories",
  },
];

export function normalizeProjectLocationScope(raw: unknown): ProjectLocationScope {
  if (raw === "multi_district" || raw === "multi_state" || raw === "single") {
    return raw;
  }
  return "single";
}

export function normalizeProjectDistrict(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

export function normalizeCoverageAreas(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

export function formatProjectLocationScope(scope: ProjectLocationScope | undefined): string {
  if (!scope) return "Single location";
  return PROJECT_LOCATION_SCOPES.find((s) => s.value === scope)?.label ?? scope;
}
