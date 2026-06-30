import { normalizeSdgGoals } from "@/lib/sdg";
import {
  normalizeDonorIds,
  normalizeProjectFundingType,
  normalizeProjectState,
  normalizeProjectDistrict,
  normalizeProjectLocationScope,
  normalizeCoverageAreas,
  normalizeProjectType,
  getProjectTypeConfig,
  getSetupStepIdsForType,
  getCatalogStepLabel,
  getSetupStepLabel,
  projectRequiresSetup,
  projectRequiresStaffInSetup,
  catalogShowsActivityCount,
  catalogShowsBeneficiaries,
  getAllowedKpiModes,
  getPortalEligibleProjectTypes,
  ProjectFundingType,
  ProjectLocationScope,
  ProjectType,
} from "@/lib/projectMeta";

export type ProposalStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REVISED";

export interface BudgetLineItem {
  id: string;
  label: string;
  /** Quantity / units for this subhead (e.g. 10 staff, 5 camps). */
  quantity: number;
  /** Duration in periods (e.g. 12 months). Line total = qty × duration × rate. */
  duration: number;
  /** Unit rate (₹) per qty per duration period. */
  amount: number;
  excludeAdminCost: boolean;
}

export interface BudgetCategory {
  id: string;
  title: string;
  items: BudgetLineItem[];
}

/** Each KPI tracks activity units, beneficiary count, or both on the same line. */
export type KpiTrackingMode = "activities" | "beneficiaries" | "combined";

/** How this milestone counts beneficiaries — per KPI or one summary line at the end. */
export type MilestoneBeneficiaryMode = "inline" | "milestone_total";

export interface MilestoneBeneficiarySummary {
  /** Selected catalog activities this milestone beneficiary total covers. */
  catalogItemIds: string[];
  totalBeneficiaries: number;
}

export interface ProjectMilestone {
  id: string;
  name: string;
  budgetPercent: number;
  /** inline = count on each KPI (incl. combined); milestone_total = one line at end of milestone. */
  beneficiaryMode: MilestoneBeneficiaryMode;
  beneficiarySummary: MilestoneBeneficiarySummary;
  kpis: MilestoneKPI[];
}

export interface ProjectActivity {
  id: string;
  name: string;
  description: string;
  timeline: string;
  expectedOutcome: string;
  /** Target beneficiaries for this activity; splits across milestone KPIs in setup. */
  targetBeneficiaries: number;
  /** Optional hint for milestone grouping during setup */
  milestoneStage: string;
}

/**
 * Master line item defined before milestones — totals are split across milestone KPIs.
 * Can be imported from the proposal or created new.
 */
export interface SetupCatalogItem {
  id: string;
  name: string;
  description: string;
  /** Total units e.g. 10 camps — split across activity KPIs in milestones. */
  totalActivityCount: number;
  /** Total beneficiaries — split across beneficiary KPIs in milestones. */
  totalBeneficiaries: number;
  /** Set when imported from the proposal (optional). */
  sourceProposalActivityId?: string;
}

/**
 * KPI slice within a milestone. Links to a catalog item when splitting totals.
 */
export interface MilestoneKPI {
  id: string;
  name: string;
  description: string;
  trackingMode: KpiTrackingMode;
  /** Link to master catalog line (optional for fully custom KPIs). */
  catalogItemId?: string;
  /** @deprecated use catalogItemId — kept for migrated localStorage data */
  sourceActivityId?: string;
  /** Units in this milestone slice (activity-type KPIs), e.g. 4 camps. */
  activityCount: number;
  /** Beneficiaries in this milestone slice (beneficiary-type KPIs). */
  beneficiaryCount: number;
  achievedBeneficiaries?: number;
  achievedActivityCount?: number;
}

export interface ProjectStaffAssignment {
  coordinatorId: string;
  teamMemberIds: string[];
}

/** How beneficiary totals are counted for reporting in this project. */
export type BeneficiaryCountMode = "unique" | "per_entry";

export const BENEFICIARY_COUNT_MODE_LABELS: Record<BeneficiaryCountMode, string> = {
  unique: "Unique beneficiaries — one person counts once even with multiple services",
  per_entry: "Per entry — each service or activity entry counts separately",
};

export interface ProjectSetup {
  /** Master activity & beneficiary totals — defined before milestones. */
  catalog: SetupCatalogItem[];
  milestones: ProjectMilestone[];
  staff: ProjectStaffAssignment;
  completedAt?: string;
  /** Times milestone setup was reopened after initial completion (max 2). */
  milestoneReconfigureCount?: number;
}

export interface ProjectProposal {
  id: string;
  status: ProposalStatus;
  title: string;
  location: string;
  applicantName: string;
  /** Operational model — controls modules (activities, services, setup). */
  projectType: ProjectType;
  interventionNature: string;
  duration: string;
  contactPerson: string;
  aboutUs: string;
  executiveSummary: string;
  totalBeneficiaries: number;
  /** UN SDG goal IDs (1–17) this intervention contributes to. */
  sdgGoals: number[];
  /** Funding channel — CSR, donation, government, etc. */
  fundingType: ProjectFundingType;
  /** Primary state for state-wise reporting. */
  state: string;
  /** Primary district (within state) for district-wise reporting. */
  district: string;
  /** Whether the project covers a single location, multiple districts, or multiple states. */
  locationScope: ProjectLocationScope;
  /** Additional districts or states when locationScope is multi-district or multi-state. */
  coverageAreas: string;
  /** Linked donor IDs (one donor can fund many projects). */
  donorIds: string[];
  activities: ProjectActivity[];
  budget: BudgetCategory[];
  totalEvaluation: number;
  /** Admin overhead rate (% of eligible line items). Default 5. */
  adminOverheadPercent: number;
  /** Admin overhead amount (₹); editable or derived from percent. */
  adminOverheadAmount: number;
  /** Times proposal was reopened for editing after approval (max 2). */
  proposalEditCount?: number;
  /** How to count beneficiaries in reports — unique person vs each data entry. */
  beneficiaryCountMode?: BeneficiaryCountMode;
  setup?: ProjectSetup;
  /** Theory of Change — optional M&E layer (does not change approval flow). */
  theoryOfChange?: {
    impact: string;
    outcomes: string[];
    outputs: string[];
    activities: string[];
    assumptions: string[];
  };
  /** Project risk register — optional layer. */
  risks?: Array<{
    id: string;
    title: string;
    likelihood: "LOW" | "MEDIUM" | "HIGH";
    impact: "LOW" | "MEDIUM" | "HIGH";
    mitigation: string;
  }>;
  updatedAt: string;
  createdAt: string;
}

export const WIZARD_STEPS = [
  { id: "basics", label: "Project Basics" },
  { id: "plan", label: "Plan & Budget" },
  { id: "review", label: "Review & Submit" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

export const SETUP_WIZARD_STEPS = [
  { id: "catalog", label: "Set Targets" },
  { id: "milestones", label: "Add Milestones" },
  { id: "kpis", label: "Break into Steps" },
  { id: "staff", label: "Assign Team" },
  { id: "review", label: "Review & Go Live" },
] as const;

export type SetupWizardStepId = (typeof SETUP_WIZARD_STEPS)[number]["id"];

export function getWizardStepsForProjectType(type: ProjectType | undefined) {
  const config = getProjectTypeConfig(type);
  if (config.skipActivitiesStep) {
    return WIZARD_STEPS;
  }
  return WIZARD_STEPS;
}

export function getSetupWizardStepsForProjectType(type: ProjectType | undefined) {
  const stepIds = getSetupStepIdsForType(type);
  return SETUP_WIZARD_STEPS.filter((s) => stepIds.includes(s.id as (typeof SETUP_WIZARD_STEPS)[number]["id"])).map(
    (s) => ({
      ...s,
      label: getSetupStepLabel(s.id as (typeof SETUP_WIZARD_STEPS)[number]["id"], type),
    })
  );
}

export function getSetupCatalogStepLabel(type: ProjectType | undefined): string {
  return getCatalogStepLabel(type);
}

export function getPortalEligibleProjects(): ProjectProposal[] {
  const eligibleTypes = new Set(getPortalEligibleProjectTypes());
  return loadProjects().filter(
    (p) => p.status === "APPROVED" && eligibleTypes.has(p.projectType)
  );
}

export const ADMIN_OVERHEAD_RATE = 0.05;
export const DEFAULT_ADMIN_OVERHEAD_PERCENT = 5;
export const PROJECTS_STORAGE_KEY = "ngo-hub-projects";

export const INTERVENTION_OPTIONS = ["Ongoing", "New", "Expansion", "Pilot"] as const;

export const ABOUT_US_DEFAULT = `SVITECH FOUNDATION is a registered non-profit organization established with a mission to bridge the digital divide and promote financial inclusion among underserved communities across Maharashtra. Since its inception, SVITECH has leveraged technology-driven outreach models to deliver citizen-centric services at the grassroots level.

The Foundation operates Common Service Centres (CSCs), conducts digital literacy camps, and partners with financial institutions to enable last-mile access to banking, insurance, and government welfare schemes. Our team combines field mobilization expertise with robust program management practices to ensure measurable social impact.

Over the years, SVITECH has built trusted community networks, trained local youth as digital facilitators, and supported thousands of families in accessing entitlements they were previously unable to reach.`;

export const EXECUTIVE_SUMMARY_DEFAULT = `This proposal outlines the Adhikaar Kendra initiative — a dedicated Financial & Digital Inclusion hub at Ghatkopar designed to serve vulnerable sections of society through structured outreach, on-ground facilitation, and sustained community engagement.

The intervention will establish a fully operational service centre offering Aadhaar-enabled banking support, PMJJBY/PMSBY enrolments, pension and subsidy linkages, digital payment literacy, and social advocacy for financial rights. Through trained program staff and mobilizers, the project aims to reach 80,000 beneficiaries over 12 months with consistent, dignified access to essential digital and financial services.

The proposed budget covers human resources, program logistics, centre setup, and ongoing operational costs, with transparent admin overhead applied only to eligible line items.`;

export const EMPTY_BUDGET: BudgetCategory[] = [
  {
    id: "hr",
    title: "HR Cost",
    items: [{ id: "hr-1", label: "", quantity: 0, duration: 0, amount: 0, excludeAdminCost: false }],
  },
  {
    id: "program",
    title: "Program Cost",
    items: [{ id: "prog-1", label: "", quantity: 0, duration: 0, amount: 0, excludeAdminCost: false }],
  },
  {
    id: "setup",
    title: "Center Setup Cost",
    items: [{ id: "setup-1", label: "", quantity: 0, duration: 0, amount: 0, excludeAdminCost: false }],
  },
  {
    id: "operation",
    title: "Center Operation Cost",
    items: [{ id: "op-1", label: "", quantity: 0, duration: 0, amount: 0, excludeAdminCost: false }],
  },
];

export const INITIAL_BUDGET: BudgetCategory[] = [
  {
    id: "hr",
    title: "HR Cost",
    items: [
      { id: "hr-pm", label: "Program Manager", quantity: 1, duration: 12, amount: 35_000, excludeAdminCost: false },
      { id: "hr-csc", label: "CSC Operator", quantity: 1, duration: 12, amount: 16_000, excludeAdminCost: false },
      { id: "hr-mob", label: "Mobilizer", quantity: 1, duration: 12, amount: 60_000, excludeAdminCost: false },
    ],
  },
  {
    id: "program",
    title: "Program Cost",
    items: [
      {
        id: "prog-logistics",
        label: "FI & Social Advocacy Logistic Support",
        quantity: 1,
        duration: 12,
        amount: 8_334,
        excludeAdminCost: false,
      },
      { id: "prog-media", label: "Program Media", quantity: 1, duration: 12, amount: 3_750, excludeAdminCost: false },
    ],
  },
  {
    id: "setup",
    title: "Center Setup Cost",
    items: [
      { id: "setup-bio", label: "Biometrics", quantity: 1, duration: 1, amount: 3_000, excludeAdminCost: true },
      { id: "setup-webcam", label: "Webcam", quantity: 1, duration: 1, amount: 3_000, excludeAdminCost: true },
      { id: "setup-chairs", label: "Chairs", quantity: 1, duration: 1, amount: 12_000, excludeAdminCost: true },
    ],
  },
  {
    id: "operation",
    title: "Center Operation Cost",
    items: [
      { id: "op-maint", label: "Ghatkopar Maintenance", quantity: 1, duration: 12, amount: 25_000, excludeAdminCost: false },
      { id: "op-internet", label: "Internet", quantity: 1, duration: 12, amount: 10_000, excludeAdminCost: false },
      { id: "op-stationary", label: "Stationary", quantity: 1, duration: 12, amount: 4_167, excludeAdminCost: false },
      { id: "op-misc", label: "Misc", quantity: 1, duration: 12, amount: 4_167, excludeAdminCost: false },
    ],
  },
];

export const STATUS_STYLES: Record<
  ProposalStatus,
  { badge: string; dot: string; table: string }
> = {
  DRAFT: {
    badge: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
    dot: "bg-amber-400",
    table: "bg-amber-100 text-amber-800",
  },
  SUBMITTED: {
    badge: "bg-blue-500/15 text-blue-700 ring-blue-500/30 dark:text-blue-300",
    dot: "bg-blue-400",
    table: "bg-blue-100 text-blue-800",
  },
  APPROVED: {
    badge: "bg-brand-teal/15 text-brand-teal-dark ring-brand-teal/30 dark:text-brand-teal-light",
    dot: "bg-brand-teal-light",
    table: "bg-brand-mist text-brand-teal-dark",
  },
  REJECTED: {
    badge: "bg-red-500/15 text-red-700 ring-red-500/30 dark:text-red-300",
    dot: "bg-red-400",
    table: "bg-red-100 text-red-800",
  },
  REVISED: {
    badge: "bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:text-violet-300",
    dot: "bg-violet-400",
    table: "bg-violet-100 text-violet-800",
  },
};

export function computeBudgetLineTotal(item: BudgetLineItem): number {
  const qty = item.quantity > 0 ? item.quantity : 1;
  const duration = item.duration > 0 ? item.duration : 1;
  return qty * duration * Math.max(0, item.amount);
}

/** Milestone budget slice from proposal total — preserves decimals (no rounding). */
export function computeMilestoneBudgetAmount(totalBudget: number, budgetPercent: number): number {
  return (totalBudget * budgetPercent) / 100;
}

const BUDGET_MATCH_EPSILON = 0.01;
const PERCENT_TOTAL_EPSILON = 0.001;

export function milestoneBudgetsMatch(allocated: number, total: number): boolean {
  return Math.abs(allocated - total) < BUDGET_MATCH_EPSILON;
}

export function milestonePercentTotalMatches(totalPercent: number): boolean {
  return Math.abs(totalPercent - 100) < PERCENT_TOTAL_EPSILON;
}

export function computeBudgetTotals(
  budget: BudgetCategory[],
  adminInput?: { adminOverheadPercent?: number; adminOverheadAmount?: number }
) {
  const allItems = budget.flatMap((category) => category.items);
  const directSubtotal = allItems.reduce((sum, item) => sum + computeBudgetLineTotal(item), 0);
  const adminEligibleSubtotal = allItems
    .filter((item) => !item.excludeAdminCost)
    .reduce((sum, item) => sum + computeBudgetLineTotal(item), 0);
  const adminOverheadPercent = adminInput?.adminOverheadPercent ?? DEFAULT_ADMIN_OVERHEAD_PERCENT;
  const computedAdmin = adminEligibleSubtotal * (adminOverheadPercent / 100);
  const adminOverhead =
    adminInput?.adminOverheadAmount != null
      ? Math.max(0, adminInput.adminOverheadAmount)
      : computedAdmin;
  const totalEvaluation = directSubtotal + adminOverhead;

  return {
    directSubtotal,
    adminEligibleSubtotal,
    adminOverheadPercent,
    adminOverhead,
    totalEvaluation,
  };
}

export function budgetAdminInputFromProject(
  project: Pick<ProjectProposal, "adminOverheadPercent" | "adminOverheadAmount">
) {
  return {
    adminOverheadPercent: project.adminOverheadPercent ?? DEFAULT_ADMIN_OVERHEAD_PERCENT,
    adminOverheadAmount: project.adminOverheadAmount,
  };
}

export function createBlankBudgetLineItem(): BudgetLineItem {
  return {
    id: `bud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: "",
    quantity: 0,
    duration: 0,
    amount: 0,
    excludeAdminCost: false,
  };
}

export function createBlankBudgetCategory(): BudgetCategory {
  return {
    id: `bcat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    items: [createBlankBudgetLineItem()],
  };
}

export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) return "0";
  const hasDecimals = Math.abs(amount % 1) > 1e-9;
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 4 : 0,
  });
}

function parseBudgetDuration(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.max(0, value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    if (/one[- ]?time/i.test(trimmed)) return 1;
    const match = trimmed.match(/(\d+(?:\.\d+)?)/);
    return match ? Math.max(0, Number(match[1])) : 0;
  }
  return 0;
}

function normalizeBudgetLineItem(item: BudgetLineItem & { duration?: unknown }): BudgetLineItem {
  return {
    ...item,
    quantity: item.quantity ?? 0,
    duration: parseBudgetDuration(item.duration),
  };
}

function cloneBudget(budget: BudgetCategory[]): BudgetCategory[] {
  return budget.map((category) => ({
    ...category,
    items: category.items.map((item) => normalizeBudgetLineItem({ ...item })),
  }));
}

function cloneActivities(activities: ProjectActivity[]): ProjectActivity[] {
  return activities.map((activity) => ({
    ...activity,
    targetBeneficiaries: activity.targetBeneficiaries ?? 0,
  }));
}

function resolveKpiCatalogId(kpi: MilestoneKPI): string | undefined {
  return kpi.catalogItemId ?? kpi.sourceActivityId;
}

function normalizeKpi(
  kpi: MilestoneKPI,
  legacyMilestoneMode?: KpiTrackingMode
): MilestoneKPI {
  const catalogItemId = kpi.catalogItemId ?? kpi.sourceActivityId;
  return {
    ...kpi,
    catalogItemId,
    trackingMode: kpi.trackingMode ?? legacyMilestoneMode ?? "beneficiaries",
    activityCount: kpi.activityCount ?? 0,
    beneficiaryCount: kpi.beneficiaryCount ?? 0,
    achievedBeneficiaries: kpi.achievedBeneficiaries ?? 0,
    achievedActivityCount: kpi.achievedActivityCount ?? 0,
  };
}

function createDefaultBeneficiarySummary(): MilestoneBeneficiarySummary {
  return { catalogItemIds: [], totalBeneficiaries: 0 };
}

function normalizeMilestone(milestone: ProjectMilestone & { trackingMode?: KpiTrackingMode }): ProjectMilestone {
  const legacyMode = milestone.trackingMode;
  return {
    id: milestone.id,
    name: milestone.name,
    budgetPercent: milestone.budgetPercent,
    beneficiaryMode: milestone.beneficiaryMode ?? "inline",
    beneficiarySummary: {
      catalogItemIds: [...(milestone.beneficiarySummary?.catalogItemIds ?? [])],
      totalBeneficiaries: milestone.beneficiarySummary?.totalBeneficiaries ?? 0,
    },
    kpis: milestone.kpis.map((k) => normalizeKpi(k, legacyMode)),
  };
}

function cloneSetup(setup: ProjectSetup | undefined): ProjectSetup | undefined {
  if (!setup) return undefined;
  return {
    ...setup,
    catalog: (setup.catalog ?? []).map((c) => ({ ...c })),
    milestones: setup.milestones.map((m) => normalizeMilestone(m)),
    staff: {
      coordinatorId: setup.staff?.coordinatorId ?? "",
      teamMemberIds: [...(setup.staff?.teamMemberIds ?? [])],
    },
    milestoneReconfigureCount: setup.milestoneReconfigureCount ?? 0,
  };
}

function normalizeProject(raw: ProjectProposal): ProjectProposal {
  const budget = raw.budget?.length ? cloneBudget(raw.budget) : cloneBudget(EMPTY_BUDGET);
  const activities = raw.activities?.length ? cloneActivities(raw.activities) : [];
  const adminOverheadPercent = raw.adminOverheadPercent ?? DEFAULT_ADMIN_OVERHEAD_PERCENT;
  const totals = computeBudgetTotals(budget, {
    adminOverheadPercent,
    adminOverheadAmount: raw.adminOverheadAmount,
  });

  return {
    ...raw,
    activities,
    budget,
    totalBeneficiaries: raw.totalBeneficiaries ?? 0,
    sdgGoals: normalizeSdgGoals(raw.sdgGoals),
    fundingType: normalizeProjectFundingType(raw.fundingType),
    state: normalizeProjectState(raw.state),
    district: normalizeProjectDistrict(raw.district),
    locationScope: normalizeProjectLocationScope(raw.locationScope),
    coverageAreas: normalizeCoverageAreas(raw.coverageAreas),
    donorIds: normalizeDonorIds(raw.donorIds),
    projectType: normalizeProjectType(raw.projectType),
    adminOverheadPercent,
    adminOverheadAmount: raw.adminOverheadAmount ?? totals.adminOverhead,
    proposalEditCount: raw.proposalEditCount ?? 0,
    beneficiaryCountMode: raw.beneficiaryCountMode ?? "unique",
    totalEvaluation: totals.totalEvaluation,
    setup: cloneSetup(raw.setup),
    status: raw.status ?? "DRAFT",
  };
}

/** Distinct place names for a project — used for location-wise community contribution rates. */
export function listProjectLocations(
  project: Pick<ProjectProposal, "location" | "district" | "state" | "coverageAreas">
): string[] {
  const locs = new Set<string>();
  const add = (value?: string) => {
    const trimmed = value?.trim();
    if (trimmed) locs.add(trimmed);
  };
  add(project.location);
  add(project.district);
  add(project.state);
  if (project.coverageAreas?.trim()) {
    for (const part of project.coverageAreas.split(/[,;\n]+/)) {
      add(part);
    }
  }
  return [...locs].sort((a, b) => a.localeCompare(b));
}

export function createEmptyProject(id: string): ProjectProposal {
  const budget = cloneBudget(EMPTY_BUDGET);
  const now = new Date().toISOString();

  return {
    id,
    status: "DRAFT",
    title: "",
    location: "",
    applicantName: "",
    projectType: "FULL_PROGRAM",
    interventionNature: "Ongoing",
    duration: "",
    contactPerson: "",
    aboutUs: "",
    executiveSummary: "",
    totalBeneficiaries: 0,
    sdgGoals: [],
    fundingType: "CSR",
    state: "",
    district: "",
    locationScope: "single",
    coverageAreas: "",
    donorIds: [],
    activities: [createBlankActivity()],
    budget,
    adminOverheadPercent: DEFAULT_ADMIN_OVERHEAD_PERCENT,
    adminOverheadAmount: 0,
    totalEvaluation: 0,
    beneficiaryCountMode: "unique",
    createdAt: now,
    updatedAt: now,
  };
}

/** Copy structure from an approved project as a new draft template. */
export function cloneProjectFromTemplate(source: ProjectProposal, newId: string): ProjectProposal {
  const now = new Date().toISOString();
  const cloneId = () => `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    ...source,
    id: newId,
    status: "DRAFT",
    title: `${source.title} (copy)`,
    setup: undefined,
    proposalEditCount: 0,
    activities: source.activities.map((a) => ({ ...a, id: cloneId() })),
    budget: source.budget.map((cat) => ({
      ...cat,
      id: cloneId(),
      items: cat.items.map((item) => ({ ...item, id: cloneId() })),
    })),
    theoryOfChange: source.theoryOfChange
      ? { ...source.theoryOfChange, outcomes: [...source.theoryOfChange.outcomes], outputs: [...source.theoryOfChange.outputs], activities: [...source.theoryOfChange.activities], assumptions: [...source.theoryOfChange.assumptions] }
      : undefined,
    risks: source.risks?.map((r) => ({ ...r, id: cloneId() })),
    createdAt: now,
    updatedAt: now,
  };
}

export function listApprovedProjectTemplates(): ProjectProposal[] {
  return loadProjects().filter((p) => p.status === "APPROVED");
}

export function createBlankActivity(): ProjectActivity {
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    description: "",
    timeline: "",
    expectedOutcome: "",
    targetBeneficiaries: 0,
    milestoneStage: "",
  };
}

export function sumActivityBeneficiaryTargets(activities: ProjectActivity[]) {
  return activities.reduce((sum, a) => sum + (a.targetBeneficiaries ?? 0), 0);
}

export function getSeedProjects(): ProjectProposal[] {
  return [];
}

export function loadProjects(): ProjectProposal[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = (JSON.parse(raw) as ProjectProposal[]).map(normalizeProject);
    return parsed;
  } catch {
    return [];
  }
}

export function saveProjects(projects: ProjectProposal[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

export function getProjectById(id: string): ProjectProposal | undefined {
  const project = loadProjects().find((entry) => entry.id === id);
  return project ? normalizeProject(project) : undefined;
}

export function upsertProject(project: ProjectProposal) {
  const normalized = normalizeProject({
    ...project,
    totalEvaluation: computeBudgetTotals(project.budget, budgetAdminInputFromProject(project))
      .totalEvaluation,
    updatedAt: new Date().toISOString(),
  });

  const projects = loadProjects();
  const index = projects.findIndex((entry) => entry.id === normalized.id);
  const next =
    index >= 0
      ? projects.map((entry, i) => (i === index ? normalized : entry))
      : [...projects, normalized];
  saveProjects(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("projects-updated"));
  }
  return normalized;
}

export function deleteProject(id: string) {
  const projects = loadProjects().filter((entry) => entry.id !== id);
  saveProjects(projects);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("projects-updated"));
  }
}

export function isEditableStatus(status: ProposalStatus) {
  return status === "DRAFT" || status === "REVISED";
}

export const MAX_PROPOSAL_EDITS_AFTER_APPROVAL = 2;

export function getProposalEditCount(project: ProjectProposal): number {
  return project.proposalEditCount ?? 0;
}

export function canEditApprovedProposal(project: ProjectProposal): boolean {
  return (
    project.status === "APPROVED" &&
    getProposalEditCount(project) < MAX_PROPOSAL_EDITS_AFTER_APPROVAL
  );
}

/** Open wizard for draft/revised, or an approved project with an active edit session. */
export function canAccessProposalEditPage(project: ProjectProposal): boolean {
  if (isEditableStatus(project.status)) return true;
  return project.status === "APPROVED" && getProposalEditCount(project) > 0;
}

export function canOpenProposalEditor(project: ProjectProposal): boolean {
  return isEditableStatus(project.status) || canEditApprovedProposal(project);
}

export function startApprovedProposalEdit(project: ProjectProposal): ProjectProposal | null {
  if (!canEditApprovedProposal(project)) return null;
  const updated: ProjectProposal = {
    ...project,
    proposalEditCount: getProposalEditCount(project) + 1,
    updatedAt: new Date().toISOString(),
  };
  upsertProject(updated);
  return updated;
}

export function isSetupComplete(project: ProjectProposal) {
  if (!projectRequiresSetup(project.projectType)) {
    return project.status === "APPROVED";
  }
  return Boolean(project.setup?.completedAt);
}

export function needsMilestoneSetup(project: ProjectProposal) {
  if (!projectRequiresSetup(project.projectType)) return false;
  return project.status === "APPROVED" && !isSetupComplete(project);
}

export const MAX_MILESTONE_RECONFIGURATIONS = 2;

export function getMilestoneReconfigureCount(project: ProjectProposal): number {
  return project.setup?.milestoneReconfigureCount ?? 0;
}

export function canReconfigureMilestones(project: ProjectProposal): boolean {
  return (
    project.status === "APPROVED" &&
    isSetupComplete(project) &&
    getMilestoneReconfigureCount(project) < MAX_MILESTONE_RECONFIGURATIONS
  );
}

export function startMilestoneReconfigure(project: ProjectProposal): ProjectProposal | null {
  if (!canReconfigureMilestones(project) || !project.setup) return null;
  const updated: ProjectProposal = {
    ...project,
    setup: {
      ...project.setup,
      completedAt: undefined,
      milestoneReconfigureCount: getMilestoneReconfigureCount(project) + 1,
    },
    updatedAt: new Date().toISOString(),
  };
  upsertProject(updated);
  return updated;
}

export function createBlankMilestone(index = 1): ProjectMilestone {
  return {
    id: `ms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `Milestone ${index}`,
    budgetPercent: 0,
    beneficiaryMode: "inline",
    beneficiarySummary: createDefaultBeneficiarySummary(),
    kpis: [],
  };
}

export function countMilestoneBeneficiaries(milestone: ProjectMilestone): number {
  if (milestone.beneficiaryMode === "milestone_total") {
    return milestone.beneficiarySummary?.totalBeneficiaries ?? 0;
  }
  return milestone.kpis.reduce((sum, k) => {
    if (k.trackingMode === "beneficiaries" || k.trackingMode === "combined") {
      return sum + k.beneficiaryCount;
    }
    return sum;
  }, 0);
}

export function createBlankCatalogItem(): SetupCatalogItem {
  return {
    id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    description: "",
    totalActivityCount: 0,
    totalBeneficiaries: 0,
  };
}

export function initCatalogFromProposal(project: ProjectProposal): SetupCatalogItem[] {
  const config = getProjectTypeConfig(project.projectType);
  const projectTotal = Number(project.totalBeneficiaries) || 0;

  if (config.catalogMode === "enrollment") {
    return [
      {
        id: `cat-enroll-${Date.now()}`,
        name: "Enrollment target",
        description: "Beneficiaries to register and track through status pipeline",
        totalActivityCount: 0,
        totalBeneficiaries: projectTotal,
      },
    ];
  }

  if (config.catalogMode === "services") {
    return [
      {
        id: `cat-svc-${Date.now()}`,
        name: "Service delivery",
        description: "Individual beneficiary services to be delivered",
        totalActivityCount: 0,
        totalBeneficiaries: projectTotal,
      },
    ];
  }

  if (config.catalogMode === "deliverables") {
    return [
      {
        id: `cat-del-${Date.now()}`,
        name: "Key deliverable",
        description: "Primary institutional output or report",
        totalActivityCount: 1,
        totalBeneficiaries: 0,
      },
    ];
  }

  if (config.catalogMode === "phases") {
    return [
      {
        id: `cat-phase-${Date.now()}`,
        name: "Phase 1",
        description: "First setup phase",
        totalActivityCount: 1,
        totalBeneficiaries: 0,
      },
    ];
  }

  const items = project.activities.map((a) => ({
    id: `cat-${a.id}`,
    name: a.name,
    description: a.description,
    totalActivityCount: config.catalogMode === "single_event" ? 1 : 0,
    totalBeneficiaries: a.targetBeneficiaries ?? 0,
    sourceProposalActivityId: a.id,
  }));

  if (items.length === 0 && config.catalogMode === "single_event") {
    return [
      {
        id: `cat-event-${Date.now()}`,
        name: project.title || "Event",
        description: project.executiveSummary?.slice(0, 120) ?? "",
        totalActivityCount: 1,
        totalBeneficiaries: projectTotal,
      },
    ];
  }

  const activityBenTotal = items.reduce((sum, c) => sum + c.totalBeneficiaries, 0);

  if (projectTotal > 0 && activityBenTotal !== projectTotal && items.length > 0) {
    const perItem = Math.floor(projectTotal / items.length);
    const remainder = projectTotal - perItem * items.length;
    return items.map((item, i) => ({
      ...item,
      totalBeneficiaries: perItem + (i === 0 ? remainder : 0),
    }));
  }

  return items;
}

export function sumCatalogBeneficiaries(catalog: SetupCatalogItem[]) {
  return catalog.reduce((sum, c) => sum + c.totalBeneficiaries, 0);
}

export function sumCatalogActivityCounts(catalog: SetupCatalogItem[]) {
  return catalog.reduce((sum, c) => sum + c.totalActivityCount, 0);
}

export interface CatalogAllocationExclude {
  /** Omit this milestone's beneficiary/activity contributions (e.g. while editing its total). */
  milestoneId?: string;
  /** Omit only this KPI's inline counts within a milestone. */
  kpiId?: string;
}

/** Sum beneficiary and activity allocations per catalog line from milestone KPIs. */
export function accumulateCatalogAllocations(
  milestones: ProjectMilestone[],
  catalog: SetupCatalogItem[],
  exclude?: CatalogAllocationExclude
): { beneficiaries: Map<string, number>; activities: Map<string, number> } {
  const beneficiaries = new Map<string, number>();
  const activities = new Map<string, number>();

  for (const item of catalog) {
    beneficiaries.set(item.id, 0);
    activities.set(item.id, 0);
  }

  for (const milestone of milestones) {
    const skipMilestoneBeneficiary =
      exclude?.milestoneId === milestone.id && !exclude.kpiId;

    for (const kpi of milestone.kpis) {
      if (exclude?.milestoneId === milestone.id && exclude.kpiId === kpi.id) continue;

      const catalogId = resolveKpiCatalogId(kpi);
      if (!catalogId) continue;

      if (kpi.trackingMode === "activities" || kpi.trackingMode === "combined") {
        activities.set(catalogId, (activities.get(catalogId) ?? 0) + kpi.activityCount);
      }

      if (milestone.beneficiaryMode === "inline") {
        if (kpi.trackingMode === "beneficiaries" || kpi.trackingMode === "combined") {
          beneficiaries.set(catalogId, (beneficiaries.get(catalogId) ?? 0) + kpi.beneficiaryCount);
        }
      }
    }

    if (!skipMilestoneBeneficiary && milestone.beneficiaryMode === "milestone_total") {
      const summary = milestone.beneficiarySummary;
      const ids = summary?.catalogItemIds ?? [];
      const total = summary?.totalBeneficiaries ?? 0;
      if (ids.length > 0 && total > 0) {
        const shares = allocateMilestoneBeneficiaryTotal(ids, total, catalog);
        for (const id of ids) {
          beneficiaries.set(id, (beneficiaries.get(id) ?? 0) + (shares.get(id) ?? 0));
        }
      }
    }
  }

  return { beneficiaries, activities };
}

export function remainingCatalogBeneficiaries(
  catalogItemId: string,
  catalog: SetupCatalogItem[],
  milestones: ProjectMilestone[],
  exclude?: CatalogAllocationExclude
): number {
  const item = catalog.find((c) => c.id === catalogItemId);
  const target = item?.totalBeneficiaries ?? 0;
  const allocated = accumulateCatalogAllocations(milestones, catalog, exclude).beneficiaries.get(
    catalogItemId
  );
  return Math.max(0, target - (allocated ?? 0));
}

export function remainingCatalogActivities(
  catalogItemId: string,
  catalog: SetupCatalogItem[],
  milestones: ProjectMilestone[],
  exclude?: CatalogAllocationExclude
): number {
  const item = catalog.find((c) => c.id === catalogItemId);
  const target = item?.totalActivityCount ?? 0;
  const allocated = accumulateCatalogAllocations(milestones, catalog, exclude).activities.get(
    catalogItemId
  );
  return Math.max(0, target - (allocated ?? 0));
}

/** Max milestone beneficiary total that keeps each selected catalog line within its allotment. */
export function maxMilestoneBeneficiaryTotal(
  catalogItemIds: string[],
  milestones: ProjectMilestone[],
  catalog: SetupCatalogItem[],
  editingMilestoneId: string
): number {
  if (catalogItemIds.length === 0) return 0;

  const exclude = { milestoneId: editingMilestoneId };
  const maxPerId = new Map(
    catalogItemIds.map((id) => [
      id,
      remainingCatalogBeneficiaries(id, catalog, milestones, exclude),
    ])
  );
  const sumRemaining = [...maxPerId.values()].reduce((sum, n) => sum + n, 0);
  if (sumRemaining <= 0) return 0;

  let lo = 0;
  let hi = sumRemaining;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (milestoneBeneficiaryTotalFits(catalogItemIds, mid, catalog, maxPerId)) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

function milestoneBeneficiaryTotalFits(
  catalogItemIds: string[],
  total: number,
  catalog: SetupCatalogItem[],
  maxPerId: ReadonlyMap<string, number>
): boolean {
  if (total <= 0) return true;
  const shares = allocateMilestoneBeneficiaryTotal(catalogItemIds, total, catalog, maxPerId);
  const allocated = catalogItemIds.reduce((sum, id) => sum + (shares.get(id) ?? 0), 0);
  return allocated === total;
}

/** Proportional split (largest remainder) across catalog lines — sum of shares equals total. */
function distributeBeneficiaryTotalAmongIds(
  catalogItemIds: string[],
  total: number,
  catalog: SetupCatalogItem[]
): Map<string, number> {
  const result = new Map<string, number>();
  for (const id of catalogItemIds) result.set(id, 0);
  if (catalogItemIds.length === 0 || total <= 0) return result;

  const weights = catalogItemIds.map((id) => {
    const item = catalog.find((c) => c.id === id);
    return { id, weight: item?.totalBeneficiaries ?? 0 };
  });
  const weightSum = weights.reduce((sum, w) => sum + w.weight, 0);

  if (weightSum <= 0) {
    let remainder = total;
    const per = Math.floor(total / catalogItemIds.length);
    for (const id of catalogItemIds) {
      const share = Math.min(per + (remainder > 0 ? 1 : 0), remainder);
      result.set(id, share);
      remainder -= share;
    }
    return result;
  }

  const rows = weights.map((w) => ({
    id: w.id,
    exact: (total * w.weight) / weightSum,
  }));
  let floorSum = 0;
  for (const row of rows) {
    const floor = Math.floor(row.exact);
    result.set(row.id, floor);
    floorSum += floor;
  }
  let leftover = total - floorSum;
  rows
    .map((row) => ({ id: row.id, fraction: row.exact - Math.floor(row.exact) }))
    .sort((a, b) => b.fraction - a.fraction || a.id.localeCompare(b.id))
    .forEach((row) => {
      if (leftover <= 0) return;
      result.set(row.id, (result.get(row.id) ?? 0) + 1);
      leftover--;
    });
  return result;
}

/** Split a milestone beneficiary total across selected catalog lines (proportional to catalog targets). */
export function allocateMilestoneBeneficiaryTotal(
  catalogItemIds: string[],
  total: number,
  catalog: SetupCatalogItem[],
  maxPerId?: ReadonlyMap<string, number>
): Map<string, number> {
  const result = new Map<string, number>();
  for (const id of catalogItemIds) result.set(id, 0);
  if (catalogItemIds.length === 0 || total <= 0) return result;

  const activeIds = maxPerId
    ? catalogItemIds.filter((id) => (maxPerId.get(id) ?? 0) > 0)
    : [...catalogItemIds];
  if (activeIds.length === 0) return result;

  const effectiveTotal = maxPerId
    ? Math.min(total, activeIds.reduce((sum, id) => sum + (maxPerId.get(id) ?? 0), 0))
    : total;

  const inner = distributeBeneficiaryTotalAmongIds(activeIds, effectiveTotal, catalog);
  for (const [id, share] of inner) {
    result.set(id, share);
  }
  return result;
}

export function capCatalogItemBeneficiaries(
  catalog: SetupCatalogItem[],
  itemId: string,
  requested: number,
  projectTarget: number
): number {
  const safe = Math.max(0, requested);
  if (projectTarget <= 0) return safe;
  const otherSum = catalog
    .filter((c) => c.id !== itemId)
    .reduce((sum, c) => sum + c.totalBeneficiaries, 0);
  return Math.min(safe, Math.max(0, projectTarget - otherSum));
}

export function capActivityBeneficiaryTarget(
  activities: ProjectActivity[],
  activityId: string,
  requested: number,
  projectTotal: number
): number {
  const safe = Math.max(0, requested);
  if (projectTotal <= 0) return safe;
  const otherSum = activities
    .filter((a) => a.id !== activityId)
    .reduce((sum, a) => sum + (a.targetBeneficiaries ?? 0), 0);
  return Math.min(safe, Math.max(0, projectTotal - otherSum));
}

export function createKpiFromCatalogItem(
  item: SetupCatalogItem,
  trackingMode: KpiTrackingMode = "beneficiaries"
): MilestoneKPI {
  return {
    id: `kpi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: item.name,
    description: item.description,
    trackingMode,
    catalogItemId: item.id,
    activityCount: 0,
    beneficiaryCount: 0,
  };
}

/** @deprecated use createKpiFromCatalogItem */
export function createKpiFromActivity(
  activity: ProjectActivity,
  trackingMode: KpiTrackingMode = "beneficiaries"
): MilestoneKPI {
  return {
    id: `kpi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: activity.name,
    description: activity.description,
    trackingMode,
    catalogItemId: `cat-${activity.id}`,
    activityCount: 0,
    beneficiaryCount: trackingMode === "beneficiaries" ? activity.targetBeneficiaries ?? 0 : 0,
  };
}

export function createBlankKpi(trackingMode: KpiTrackingMode = "beneficiaries"): MilestoneKPI {
  return {
    id: `kpi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    description: "",
    trackingMode,
    activityCount: 0,
    beneficiaryCount: 0,
  };
}

export interface CatalogRollup {
  catalogItemId: string;
  name: string;
  targetActivityCount: number;
  allocatedActivityCount: number;
  targetBeneficiaries: number;
  allocatedBeneficiaries: number;
  activitiesMatch: boolean;
  beneficiariesMatch: boolean;
  sliceCount: number;
}

export function getMilestoneBeneficiaryCaps(
  catalogItemIds: string[],
  catalog: SetupCatalogItem[],
  milestones: ProjectMilestone[],
  editingMilestoneId: string
): Map<string, number> {
  const exclude = { milestoneId: editingMilestoneId };
  return new Map(
    catalogItemIds.map((id) => [
      id,
      remainingCatalogBeneficiaries(id, catalog, milestones, exclude),
    ])
  );
}

export function computeCatalogRollups(
  milestones: ProjectMilestone[],
  catalog: SetupCatalogItem[]
): CatalogRollup[] {
  const beneficiaryByCatalog = new Map<string, number>();
  const activityByCatalog = new Map<string, number>();
  const sliceCountByCatalog = new Map<string, number>();

  for (const item of catalog) {
    beneficiaryByCatalog.set(item.id, 0);
    activityByCatalog.set(item.id, 0);
    sliceCountByCatalog.set(item.id, 0);
  }

  for (const milestone of milestones) {
    for (const kpi of milestone.kpis) {
      const catalogId = resolveKpiCatalogId(kpi);
      if (!catalogId) continue;

      sliceCountByCatalog.set(catalogId, (sliceCountByCatalog.get(catalogId) ?? 0) + 1);

      if (kpi.trackingMode === "activities" || kpi.trackingMode === "combined") {
        activityByCatalog.set(
          catalogId,
          (activityByCatalog.get(catalogId) ?? 0) + kpi.activityCount
        );
      }

      if (milestone.beneficiaryMode === "inline") {
        if (kpi.trackingMode === "beneficiaries" || kpi.trackingMode === "combined") {
          beneficiaryByCatalog.set(
            catalogId,
            (beneficiaryByCatalog.get(catalogId) ?? 0) + kpi.beneficiaryCount
          );
        }
      }
    }

    if (milestone.beneficiaryMode === "milestone_total") {
      const summary = milestone.beneficiarySummary;
      const ids = summary?.catalogItemIds ?? [];
      const total = summary?.totalBeneficiaries ?? 0;
      if (ids.length > 0 && total > 0) {
        const shares = allocateMilestoneBeneficiaryTotal(ids, total, catalog);
        for (const id of ids) {
          if (!beneficiaryByCatalog.has(id)) beneficiaryByCatalog.set(id, 0);
          beneficiaryByCatalog.set(id, (beneficiaryByCatalog.get(id) ?? 0) + (shares.get(id) ?? 0));
          sliceCountByCatalog.set(id, (sliceCountByCatalog.get(id) ?? 0) + 1);
        }
      }
    }
  }

  return catalog.map((item) => {
    const allocatedActivityCount = activityByCatalog.get(item.id) ?? 0;
    const allocatedBeneficiaries = beneficiaryByCatalog.get(item.id) ?? 0;
    return {
      catalogItemId: item.id,
      name: item.name,
      targetActivityCount: item.totalActivityCount,
      allocatedActivityCount,
      targetBeneficiaries: item.totalBeneficiaries,
      allocatedBeneficiaries,
      activitiesMatch:
        item.totalActivityCount === 0 || allocatedActivityCount === item.totalActivityCount,
      beneficiariesMatch:
        item.totalBeneficiaries === 0 || allocatedBeneficiaries === item.totalBeneficiaries,
      sliceCount: sliceCountByCatalog.get(item.id) ?? 0,
    };
  });
}

export interface CatalogAchievementTotals {
  targetActivities: number;
  achievedActivities: number;
  targetBeneficiaries: number;
  achievedBeneficiaries: number;
}

function sumKpiAchievementTotals(milestones: ProjectMilestone[]): CatalogAchievementTotals {
  let targetActivities = 0;
  let achievedActivities = 0;
  let targetBeneficiaries = 0;
  let achievedBeneficiaries = 0;

  for (const milestone of milestones) {
    for (const kpi of milestone.kpis) {
      if (kpi.trackingMode === "activities" || kpi.trackingMode === "combined") {
        targetActivities += kpi.activityCount;
        achievedActivities += kpi.achievedActivityCount ?? 0;
      }
      if (milestone.beneficiaryMode === "inline") {
        if (kpi.trackingMode === "beneficiaries" || kpi.trackingMode === "combined") {
          targetBeneficiaries += kpi.beneficiaryCount;
          achievedBeneficiaries += kpi.achievedBeneficiaries ?? 0;
        }
      }
    }
    if (milestone.beneficiaryMode === "milestone_total") {
      targetBeneficiaries += milestone.beneficiarySummary?.totalBeneficiaries ?? 0;
    }
  }

  return { targetActivities, achievedActivities, targetBeneficiaries, achievedBeneficiaries };
}

/**
 * Project-wide targets/achievements counted once per catalog activity line.
 * Multiple KPIs linked to the same catalog item still roll up per milestone for progress.
 */
export function computeCatalogAchievementTotals(setup: ProjectSetup): CatalogAchievementTotals {
  const catalog = setup.catalog ?? [];
  const milestones = setup.milestones ?? [];

  if (catalog.length === 0) {
    return sumKpiAchievementTotals(milestones);
  }

  const catalogIds = new Set(catalog.map((c) => c.id));
  const achievedByCatalog = new Map<string, { activities: number; beneficiaries: number }>();
  let uncataloguedTargets = { activities: 0, beneficiaries: 0 };
  let uncataloguedAchieved = { activities: 0, beneficiaries: 0 };

  for (const milestone of milestones) {
    for (const kpi of milestone.kpis) {
      const catalogId = resolveKpiCatalogId(kpi);
      const tracksActivity = kpi.trackingMode === "activities" || kpi.trackingMode === "combined";
      const tracksBeneficiary =
        milestone.beneficiaryMode === "inline" &&
        (kpi.trackingMode === "beneficiaries" || kpi.trackingMode === "combined");

      if (catalogId && catalogIds.has(catalogId)) {
        const row = achievedByCatalog.get(catalogId) ?? { activities: 0, beneficiaries: 0 };
        if (tracksActivity) row.activities += kpi.achievedActivityCount ?? 0;
        if (tracksBeneficiary) row.beneficiaries += kpi.achievedBeneficiaries ?? 0;
        achievedByCatalog.set(catalogId, row);
      } else {
        if (tracksActivity) {
          uncataloguedTargets.activities += kpi.activityCount;
          uncataloguedAchieved.activities += kpi.achievedActivityCount ?? 0;
        }
        if (tracksBeneficiary) {
          uncataloguedTargets.beneficiaries += kpi.beneficiaryCount;
          uncataloguedAchieved.beneficiaries += kpi.achievedBeneficiaries ?? 0;
        }
      }
    }
  }

  let achievedActivities = uncataloguedAchieved.activities;
  let achievedBeneficiaries = uncataloguedAchieved.beneficiaries;
  for (const row of achievedByCatalog.values()) {
    achievedActivities += row.activities;
    achievedBeneficiaries += row.beneficiaries;
  }

  return {
    targetActivities: sumCatalogActivityCounts(catalog) + uncataloguedTargets.activities,
    targetBeneficiaries: sumCatalogBeneficiaries(catalog) + uncataloguedTargets.beneficiaries,
    achievedActivities,
    achievedBeneficiaries,
  };
}

/** @deprecated use computeCatalogRollups */
export interface ActivityBeneficiaryRollup {
  activityId: string;
  activityName: string;
  target: number;
  allocatedBeneficiaries: number;
  sliceCount: number;
  beneficiariesMatch: boolean;
}

export function computeActivityRollups(
  milestones: ProjectMilestone[],
  activities: ProjectActivity[]
): ActivityBeneficiaryRollup[] {
  const catalog: SetupCatalogItem[] = activities.map((a) => ({
    id: `cat-${a.id}`,
    name: a.name,
    description: a.description,
    totalActivityCount: 0,
    totalBeneficiaries: a.targetBeneficiaries ?? 0,
    sourceProposalActivityId: a.id,
  }));
  return computeCatalogRollups(milestones, catalog).map((r) => ({
    activityId: r.catalogItemId.replace(/^cat-/, ""),
    activityName: r.name,
    target: r.targetBeneficiaries,
    allocatedBeneficiaries: r.allocatedBeneficiaries,
    sliceCount: r.sliceCount,
    beneficiariesMatch: r.beneficiariesMatch,
  }));
}

export function computeSetupTotals(
  milestones: ProjectMilestone[],
  totalBudget: number,
  targetBeneficiaries: number,
  catalog: SetupCatalogItem[] = []
) {
  const budgetPercentTotal = milestones.reduce((sum, m) => sum + m.budgetPercent, 0);
  const milestoneBudgets = milestones.map((m) => {
    const activityKpis = m.kpis.filter((k) => k.trackingMode === "activities");
    const beneficiaryKpis = m.kpis.filter((k) => k.trackingMode === "beneficiaries");
    return {
      id: m.id,
      name: m.name,
      percent: m.budgetPercent,
      amount: computeMilestoneBudgetAmount(totalBudget, m.budgetPercent),
      activityKpiCount: activityKpis.length,
      activityUnitCount: activityKpis.reduce((sum, k) => sum + k.activityCount, 0),
      beneficiaryCount: beneficiaryKpis.reduce((sum, k) => sum + k.beneficiaryCount, 0),
    };
  });
  const allocatedBudget = milestoneBudgets.reduce((sum, m) => sum + m.amount, 0);
  const allKpis = milestones.flatMap((m) => m.kpis);
  const totalBeneficiaries = milestones.reduce((sum, m) => sum + countMilestoneBeneficiaries(m), 0);
  const totalActivityUnits = allKpis
    .filter((k) => k.trackingMode === "activities" || k.trackingMode === "combined")
    .reduce((sum, k) => sum + k.activityCount, 0);
  const kpiCount = allKpis.length;
  const catalogRollups = computeCatalogRollups(milestones, catalog);
  const catalogFullyAllocated = catalogRollups.every(
    (r) => r.activitiesMatch && r.beneficiariesMatch
  );
  const everyCatalogItemHasSlice =
    catalog.length === 0 || catalog.every((c) => catalogRollups.some((r) => r.sliceCount > 0));
  const catalogBeneficiaryTotal = sumCatalogBeneficiaries(catalog);
  const catalogActivityTotal = sumCatalogActivityCounts(catalog);

  return {
    budgetPercentTotal,
    milestoneBudgets,
    allocatedBudget,
    totalBeneficiaries,
    targetBeneficiaries,
    totalActivityUnits,
    catalogActivityTotal,
    catalogBeneficiaryTotal,
    budgetMatches: milestoneBudgetsMatch(allocatedBudget, totalBudget),
    budgetPercentMatches: milestonePercentTotalMatches(budgetPercentTotal),
    beneficiariesMatch:
      totalBeneficiaries === (catalogBeneficiaryTotal > 0 ? catalogBeneficiaryTotal : targetBeneficiaries),
    catalogBeneficiariesMatch: catalogBeneficiaryTotal === targetBeneficiaries,
    catalogFullyAllocated,
    everyCatalogItemHasSlice,
    catalogRollups,
    activityKpiCount: allKpis.filter((k) => k.trackingMode === "activities").length,
    kpiCount,
  };
}

export function initSetupFromProposal(project: ProjectProposal): ProjectSetup {
  const config = getProjectTypeConfig(project.projectType);
  const milestones =
    config.setupMode === "minimal" && config.maxActivities === 1
      ? [{ ...createBlankMilestone(1), name: "Event execution", budgetPercent: 100 }]
      : [];
  return {
    catalog: initCatalogFromProposal(project),
    milestones,
    staff: { coordinatorId: "", teamMemberIds: [] },
  };
}

export function validateCatalogStep(
  catalog: SetupCatalogItem[],
  targetBeneficiaries: number,
  projectType: ProjectType = "FULL_PROGRAM"
): string | null {
  const config = getProjectTypeConfig(projectType);

  if (catalog.length === 0) {
    switch (config.catalogMode) {
      case "phases":
        return "Add at least one setup phase.";
      case "deliverables":
        return "Add at least one deliverable.";
      case "services":
        return "Add at least one service line.";
      case "enrollment":
        return "Add at least one enrollment target line.";
      case "single_event":
        return "Add the event line item with targets.";
      default:
        return "Add at least one activity/beneficiary line item.";
    }
  }
  if (catalog.some((c) => !c.name.trim())) return "Each line item must have a name.";

  if (config.maxActivities && catalog.length > config.maxActivities) {
    return `This project type allows at most ${config.maxActivities} line item(s).`;
  }

  const skipBeneficiary = !catalogShowsBeneficiaries(projectType);
  const skipActivity = !catalogShowsActivityCount(projectType);

  if (skipBeneficiary && skipActivity) return null;

  if (!skipBeneficiary) {
    const benTotal = sumCatalogBeneficiaries(catalog);
    const target = Number(targetBeneficiaries) || 0;
    if (target > 0 && benTotal !== target) {
      return `Catalog beneficiaries (${benTotal.toLocaleString("en-IN")}) must match proposal total (${target.toLocaleString("en-IN")}).`;
    }
    if (benTotal <= 0 && config.beneficiaryMode !== "aggregate") {
      return "Enter beneficiary totals on at least one catalog line item.";
    }
  }

  if (!skipActivity && config.catalogMode === "deliverables") {
    if (catalog.every((c) => c.totalActivityCount <= 0)) {
      return "Each deliverable needs a count (e.g. 1 report, 3 trainings).";
    }
  }

  return null;
}

export function validateKpisStep(
  setup: ProjectSetup,
  totalBudget: number,
  targetBeneficiaries: number,
  projectType: ProjectType = "FULL_PROGRAM"
): string | null {
  const config = getProjectTypeConfig(projectType);
  const allowedModes = new Set(getAllowedKpiModes(projectType));
  const catalog = setup.catalog ?? [];
  const skipBeneficiary = !catalogShowsBeneficiaries(projectType);
  const skipActivityRollup = config.catalogMode === "enrollment";

  if (setup.milestones.length === 0) return "Add at least one milestone.";
  const totals = computeSetupTotals(setup.milestones, totalBudget, targetBeneficiaries, catalog);
  if (!totals.budgetPercentMatches) {
    return `Milestone budget percentages must total 100% (currently ${totals.budgetPercentTotal}%).`;
  }
  if (setup.milestones.some((m) => !m.name.trim())) {
    return "Each milestone must have a name.";
  }
  if (setup.milestones.some((m) => m.kpis.length === 0)) {
    return "Each milestone must have at least one KPI.";
  }
  const invalidKpi = setup.milestones.flatMap((m) => m.kpis).find((k) => !k.name.trim());
  if (invalidKpi) return "Each KPI must have a name.";

  for (const milestone of setup.milestones) {
    if (!skipBeneficiary && milestone.beneficiaryMode === "milestone_total") {
      const summary = milestone.beneficiarySummary;
      if (!summary?.catalogItemIds?.length) {
        return `Milestone "${milestone.name}" needs at least one catalog line selected for the beneficiary total.`;
      }
      if ((summary.totalBeneficiaries ?? 0) <= 0) {
        return `Milestone "${milestone.name}" needs a beneficiary total.`;
      }
    }

    for (const kpi of milestone.kpis) {
      if (!allowedModes.has(kpi.trackingMode)) {
        return `KPI "${kpi.name || "Untitled"}" uses a tracking mode not allowed for ${config.label} projects.`;
      }

      const linkedCatalog = kpi.catalogItemId
        ? catalog.find((c) => c.id === kpi.catalogItemId)
        : undefined;
      const activityTrackingRequired = linkedCatalog
        ? linkedCatalog.totalActivityCount > 0
        : catalog.some((c) => c.totalActivityCount > 0);

      if (
        (kpi.trackingMode === "activities" || kpi.trackingMode === "combined") &&
        kpi.activityCount <= 0 &&
        activityTrackingRequired
      ) {
        return `Activity KPI "${kpi.name || "Untitled"}" needs a count (e.g. 10 camps).`;
      }
      if (!skipBeneficiary) {
        if (milestone.beneficiaryMode === "inline") {
          if (kpi.trackingMode === "beneficiaries" && kpi.beneficiaryCount <= 0) {
            return `Beneficiary KPI "${kpi.name || "Untitled"}" needs a beneficiary target.`;
          }
          if (kpi.trackingMode === "combined") {
            if (kpi.activityCount <= 0 && activityTrackingRequired) {
              return `Combined KPI "${kpi.name || "Untitled"}" needs an activity count.`;
            }
            if (kpi.beneficiaryCount <= 0) {
              return `Combined KPI "${kpi.name || "Untitled"}" needs a beneficiary count.`;
            }
          }
        } else if (kpi.trackingMode === "beneficiaries" || kpi.trackingMode === "combined") {
          return `Milestone "${milestone.name}" uses a milestone beneficiary total — use Activity KPIs only, or switch to per-KPI counting.`;
        }
      }
    }
  }

  if (!skipBeneficiary) {
    const beneficiaryTarget =
      totals.catalogBeneficiaryTotal > 0 ? totals.catalogBeneficiaryTotal : targetBeneficiaries;
    if (!totals.beneficiariesMatch) {
      return `Milestone beneficiaries (${totals.totalBeneficiaries.toLocaleString("en-IN")}) must match catalog total (${beneficiaryTarget.toLocaleString("en-IN")}).`;
    }
  }
  if (!totals.catalogFullyAllocated) {
    const mismatch = totals.catalogRollups.find((r) => {
      if (skipBeneficiary || skipActivityRollup) {
        return r.targetActivityCount > 0 && !r.activitiesMatch;
      }
      return (
        (r.targetBeneficiaries > 0 && !r.beneficiariesMatch) ||
        (r.targetActivityCount > 0 && !r.activitiesMatch)
      );
    });
    if (mismatch) {
      if (mismatch.targetBeneficiaries > 0 && !mismatch.beneficiariesMatch) {
        return `"${mismatch.name}" beneficiary splits (${mismatch.allocatedBeneficiaries.toLocaleString("en-IN")}) must equal catalog total (${mismatch.targetBeneficiaries.toLocaleString("en-IN")}).`;
      }
      if (mismatch.targetActivityCount > 0 && !mismatch.activitiesMatch) {
        return `"${mismatch.name}" activity splits (${mismatch.allocatedActivityCount}) must equal catalog total (${mismatch.targetActivityCount}).`;
      }
    }
    return "Catalog splits do not match milestone KPI totals. Check activity and beneficiary counts.";
  }
  if (!totals.everyCatalogItemHasSlice) {
    return "Each catalog line item must appear in at least one milestone KPI.";
  }
  return null;
}

export function validateSetup(
  setup: ProjectSetup,
  totalBudget: number,
  targetBeneficiaries: number,
  projectType: ProjectType = "FULL_PROGRAM"
): string | null {
  const catalog = setup.catalog ?? [];
  const catalogError = validateCatalogStep(catalog, targetBeneficiaries, projectType);
  if (catalogError) return catalogError;

  const kpisError = validateKpisStep(setup, totalBudget, targetBeneficiaries, projectType);
  if (kpisError) return kpisError;

  const totals = computeSetupTotals(setup.milestones, totalBudget, targetBeneficiaries, catalog);
  if (!totals.budgetMatches) {
    return `Allocated milestone budget (₹${formatINR(totals.allocatedBudget)}) must match proposal total (₹${formatINR(totalBudget)}). Adjust percentages.`;
  }
  if (projectRequiresStaffInSetup(projectType) && !setup.staff.coordinatorId) {
    return "Select a project coordinator.";
  }
  return null;
}
