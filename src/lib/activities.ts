import {
  getProjectById,
  isSetupComplete,
  loadProjects,
  ProjectProposal,
  upsertProject,
  type BeneficiaryCountMode,
} from "@/lib/projects";
import { projectSupportsActivities } from "@/lib/projectMeta";
import { localDateKey } from "@/lib/hr-utils";

export type ActivityWorkType = "office" | "project" | "workshop" | "other";
export type ProjectActivitySubType = "group" | "one_on_one";
export type ActivityTaskStatus =
  | "assigned"
  | "active"
  | "completed"
  | "rescheduled"
  | "canceled";
export type ActivitySource = "milestone_kpi" | "additional";

/** Short activity type used in codes — e.g. svi/adhikar/camp/1 */
export type ActivityKind = "camp" | "meet" | "workshop" | "office" | "other";

/** How beneficiaries are captured for an activity task. */
export type BeneficiaryMode = "list" | "count" | "none";

export interface BeneficiaryEntry {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  /** Mobile number — primary lookup key */
  contact?: string;
  address?: string;
  location?: string;
  category?: string;
  /** Annual household income in INR */
  annualIncome?: number;
  familyMembers?: number;
  notes?: string;
  /** Service taken during this data entry (portal service id) */
  serviceId?: string;
  serviceName?: string;
  isUrgentCase?: boolean;
  isCaseStudy?: boolean;
  /** Linked service portal beneficiary id */
  portalBeneficiaryId?: string;
  beneficiaryCode?: string;
  /** Special cohort tags (PWD, migrant, etc.) */
  cohorts?: string[];
  /** Whether beneficiary community contribution was collected at data entry. */
  contributionCollectionStatus?: "COLLECTED" | "PENDING";
}

export interface FileAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  uploadedAt: string;
}

export interface ActivityTask {
  id: string;
  /** Structured code: svi/{project}/{kind}/{seq} */
  activityCode?: string;
  activityKind?: ActivityKind;
  /** Denormalized project short code for numbering */
  projectCode?: string;
  projectId: string;
  projectTitle: string;
  milestoneId?: string;
  milestoneName?: string;
  kpiId?: string;
  kpiName?: string;
  catalogItemId?: string;
  title: string;
  description?: string;
  workType: ActivityWorkType;
  projectSubType?: ProjectActivitySubType;
  source: ActivitySource;
  /** @deprecated use beneficiaryMode — kept for migrated localStorage data */
  requiresBeneficiaryList?: boolean;
  beneficiaryMode: BeneficiaryMode;
  assignedToUserId: string;
  assignedByUserId: string;
  scheduledDate?: string;
  status: ActivityTaskStatus;
  startedAt?: string;
  completedAt?: string;
  rescheduledTo?: string;
  cancelReason?: string;
  beneficiaryCount?: number;
  beneficiaries?: BeneficiaryEntry[];
  photoAttachments?: FileAttachment[];
  pdfAttachments?: FileAttachment[];
  notes?: string;
  /** GPS + timestamp captured at field completion */
  evidenceLatitude?: number;
  evidenceLongitude?: number;
  evidenceCapturedAt?: string;
  /** Linked approved activity request id */
  activityRequestId?: string;
  createdAt: string;
  updatedAt: string;
}

export const ACTIVITIES_STORAGE_KEY = "ngo-hub-activities";
export const ORG_ACTIVITY_PREFIX = "svi";

export function slugifyProjectCode(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "project";
}

/** First word of project title — e.g. "Adhikaar Kendra" → "adhikaar" */
export function deriveProjectCode(title: string): string {
  const first = title.trim().split(/\s+/)[0] ?? "project";
  return slugifyProjectCode(first);
}

export function resolveActivityKind(
  task: Pick<ActivityTask, "workType" | "projectSubType" | "title">
): ActivityKind {
  if (task.workType === "workshop") return "workshop";
  if (task.workType === "office") return "office";
  if (task.workType === "other") return "other";
  const titleLower = task.title.toLowerCase();
  if (titleLower.includes("meet")) return "meet";
  if (titleLower.includes("camp")) return "camp";
  if (task.projectSubType === "one_on_one") return "meet";
  return "camp";
}

export function generateActivityCode(
  projectCode: string,
  activityKind: ActivityKind,
  existingTasks: ActivityTask[] = loadActivityTasks()
): string {
  const normalizedProject = slugifyProjectCode(projectCode);
  const prefix = `${ORG_ACTIVITY_PREFIX}/${normalizedProject}/${activityKind}`;
  const maxSeq = existingTasks.reduce((max, task) => {
    if (!task.activityCode?.startsWith(`${prefix}/`)) return max;
    const seq = parseInt(task.activityCode.split("/").pop() ?? "0", 10);
    return Number.isFinite(seq) ? Math.max(max, seq) : max;
  }, 0);
  return `${prefix}/${maxSeq + 1}`;
}

function backfillActivityCodes(tasks: ActivityTask[]): ActivityTask[] {
  const next: ActivityTask[] = [];
  for (const task of tasks) {
    if (task.activityCode) {
      next.push(task);
      continue;
    }
    const projectCode = task.projectCode ?? deriveProjectCode(task.projectTitle);
    const activityKind = task.activityKind ?? resolveActivityKind(task);
    next.push({
      ...task,
      projectCode,
      activityKind,
      activityCode: generateActivityCode(projectCode, activityKind, next),
    });
  }
  return next;
}

/** Assign codes to legacy tasks missing activityCode. */
export function ensureActivityCodes(): void {
  const tasks = loadActivityTasks();
  const updated = backfillActivityCodes(tasks);
  const changed = updated.some((t, i) => t.activityCode !== tasks[i]?.activityCode);
  if (changed) saveActivityTasks(updated);
}

export const WORK_TYPE_LABELS: Record<ActivityWorkType, string> = {
  office: "Office Work",
  project: "Project Work",
  workshop: "Workshop",
  other: "Other",
};

export const PROJECT_SUB_TYPE_LABELS: Record<ProjectActivitySubType, string> = {
  group: "Group",
  one_on_one: "One-on-One",
};

export const BENEFICIARY_MODE_LABELS: Record<BeneficiaryMode, string> = {
  list: "Beneficiary list required",
  count: "Count only",
  none: "No beneficiary required",
};

export function getTaskBeneficiaryMode(
  task: Pick<ActivityTask, "beneficiaryMode" | "requiresBeneficiaryList">
): BeneficiaryMode {
  if (task.beneficiaryMode) return task.beneficiaryMode;
  if (task.requiresBeneficiaryList) return "list";
  return "count";
}

export function getProjectBeneficiaryCountMode(projectId: string): BeneficiaryCountMode {
  const project = getProjectById(projectId);
  return project?.beneficiaryCountMode ?? "unique";
}

export function validateActivityDate(scheduledDate?: string): { ok: boolean; message?: string } {
  if (!scheduledDate) return { ok: true };
  const taskDate = scheduledDate.slice(0, 10);
  const today = localDateKey();
  if (taskDate < today) {
    return {
      ok: false,
      message:
        "This activity was scheduled for an earlier date. Reschedule to today or contact your manager.",
    };
  }
  if (taskDate > today) {
    return {
      ok: false,
      message: "This activity is scheduled for a future date. You can only start on the scheduled day.",
    };
  }
  return { ok: true };
}

export function getTaskBeneficiaryCount(task: ActivityTask): number {
  const mode = getTaskBeneficiaryMode(task);
  if (mode === "none") return 0;
  if (mode === "list") {
    const entries = task.beneficiaries ?? [];
    if (entries.length === 0) return 0;
    const projectMode = getProjectBeneficiaryCountMode(task.projectId);
    if (projectMode === "per_entry") return entries.length;
    const unique = new Set<string>();
    for (const b of entries) {
      const key =
        b.portalBeneficiaryId ||
        (b.contact ? normalizeMobile(b.contact) : "") ||
        b.beneficiaryCode ||
        b.id;
      if (key) unique.add(key);
    }
    return unique.size || entries.length;
  }
  return task.beneficiaryCount ?? 0;
}

export const TASK_STATUS_LABELS: Record<ActivityTaskStatus, string> = {
  assigned: "Assigned",
  active: "In Progress",
  completed: "Completed",
  rescheduled: "Rescheduled",
  canceled: "Canceled",
};

export const TASK_STATUS_STYLES: Record<
  ActivityTaskStatus,
  { badge: string; dot: string }
> = {
  assigned: {
    badge: "bg-blue-500/15 text-blue-700 ring-blue-500/30",
    dot: "bg-blue-400",
  },
  active: {
    badge: "bg-amber-500/15 text-amber-700 ring-amber-500/30",
    dot: "bg-amber-400",
  },
  completed: {
    badge: "bg-brand-teal/15 text-brand-teal-dark ring-brand-teal/30",
    dot: "bg-brand-teal-light",
  },
  rescheduled: {
    badge: "bg-violet-500/15 text-violet-700 ring-violet-500/30",
    dot: "bg-violet-400",
  },
  canceled: {
    badge: "bg-red-500/15 text-red-700 ring-red-500/30",
    dot: "bg-red-400",
  },
};

function normalizeTask(raw: ActivityTask): ActivityTask {
  const beneficiaryMode =
    raw.beneficiaryMode ??
    (raw.requiresBeneficiaryList ? "list" : "count");
  return {
    ...raw,
    beneficiaryMode,
    requiresBeneficiaryList: beneficiaryMode === "list",
    scheduledDate: raw.scheduledDate?.slice(0, 10),
    rescheduledTo: raw.rescheduledTo?.slice(0, 10),
    beneficiaries: raw.beneficiaries ?? [],
    photoAttachments: raw.photoAttachments ?? [],
    pdfAttachments: raw.pdfAttachments ?? [],
    beneficiaryCount: raw.beneficiaryCount ?? 0,
  };
}

export function loadActivityTasks(): ActivityTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
    if (!raw) return [];
    return backfillActivityCodes((JSON.parse(raw) as ActivityTask[]).map(normalizeTask));
  } catch {
    return [];
  }
}

export function saveActivityTasks(tasks: ActivityTask[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(tasks));
  window.dispatchEvent(new Event("activities-updated"));
}

export function upsertActivityTask(task: ActivityTask): ActivityTask {
  const existing = loadActivityTasks();
  const projectCode = task.projectCode ?? deriveProjectCode(task.projectTitle);
  const activityKind = task.activityKind ?? resolveActivityKind(task);
  const activityCode =
    task.activityCode ?? generateActivityCode(projectCode, activityKind, existing);

  const normalized = normalizeTask({
    ...task,
    projectCode,
    activityKind,
    activityCode,
    updatedAt: new Date().toISOString(),
  });
  const tasks = loadActivityTasks();
  const index = tasks.findIndex((t) => t.id === normalized.id);
  const next =
    index >= 0
      ? tasks.map((t, i) => (i === index ? normalized : t))
      : [...tasks, normalized];
  saveActivityTasks(next);
  if (typeof window !== "undefined") {
    void import("@/lib/activity-task-sync").then(({ pushActivityTaskToServer }) =>
      pushActivityTaskToServer(normalized).catch(() => {})
    );
  }
  return normalized;
}

export function deleteActivityTask(id: string) {
  saveActivityTasks(loadActivityTasks().filter((t) => t.id !== id));
  if (typeof window !== "undefined") {
    void import("@/lib/activity-task-sync").then(({ deleteActivityTaskOnServer }) =>
      deleteActivityTaskOnServer(id).catch(() => {})
    );
  }
}

export function createTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createBeneficiaryId(): string {
  return `ben-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Projects eligible for activity assignment (approved + setup complete + type supports activities). */
export function getAssignableProjects(): ProjectProposal[] {
  return loadProjects().filter(
    (p) =>
      p.status === "APPROVED" &&
      isSetupComplete(p) &&
      projectSupportsActivities(p.projectType)
  );
}

export function getTasksForUser(userId: string): ActivityTask[] {
  return loadActivityTasks().filter((t) => t.assignedToUserId === userId);
}

export function getTasksAssignedBy(userId: string): ActivityTask[] {
  return loadActivityTasks().filter((t) => t.assignedByUserId === userId);
}

/** Tasks visible to a coordinator for projects they coordinate. */
export function getTasksForCoordinator(userId: string): ActivityTask[] {
  const projectIds = loadProjects()
    .filter((p) => p.setup?.staff?.coordinatorId === userId)
    .map((p) => p.id);
  return loadActivityTasks().filter((t) => projectIds.includes(t.projectId));
}

export function startTask(taskId: string): ActivityTask | null {
  const task = loadActivityTasks().find((t) => t.id === taskId);
  if (!task || task.status !== "assigned") return null;
  const dateCheck = validateActivityDate(task.scheduledDate ?? task.rescheduledTo);
  if (!dateCheck.ok) return null;
  return upsertActivityTask({
    ...task,
    status: "active",
    startedAt: new Date().toISOString(),
  });
}

export function rescheduleTask(
  taskId: string,
  newDate: string,
  reason?: string
): ActivityTask | null {
  const task = loadActivityTasks().find((t) => t.id === taskId);
  if (!task || (task.status !== "assigned" && task.status !== "active")) return null;
  return upsertActivityTask({
    ...task,
    status: "assigned",
    scheduledDate: newDate,
    rescheduledTo: newDate,
    startedAt: undefined,
    notes: reason ? `${task.notes ?? ""}\nRescheduled: ${reason}`.trim() : task.notes,
  });
}

export function cancelTask(taskId: string, reason: string): ActivityTask | null {
  const task = loadActivityTasks().find((t) => t.id === taskId);
  if (!task || task.status === "completed" || task.status === "canceled") return null;
  return upsertActivityTask({
    ...task,
    status: "canceled",
    cancelReason: reason,
  });
}

export function completeTask(
  taskId: string,
  data: {
    beneficiaryCount?: number;
    beneficiaries?: BeneficiaryEntry[];
    photoAttachments?: FileAttachment[];
    pdfAttachments?: FileAttachment[];
    notes?: string;
    evidenceLatitude?: number;
    evidenceLongitude?: number;
    evidenceCapturedAt?: string;
  }
): ActivityTask | null {
  const task = loadActivityTasks().find((t) => t.id === taskId);
  if (!task || task.status !== "active") return null;

  const dateCheck = validateActivityDate(task.scheduledDate ?? task.rescheduledTo);
  if (!dateCheck.ok) return null;

  const completed = upsertActivityTask({
    ...task,
    status: "completed",
    completedAt: new Date().toISOString(),
    beneficiaryCount: data.beneficiaryCount ?? task.beneficiaryCount ?? 0,
    beneficiaries: data.beneficiaries ?? task.beneficiaries,
    photoAttachments: data.photoAttachments ?? task.photoAttachments,
    pdfAttachments: data.pdfAttachments ?? task.pdfAttachments,
    notes: data.notes ?? task.notes,
    evidenceLatitude: data.evidenceLatitude ?? task.evidenceLatitude,
    evidenceLongitude: data.evidenceLongitude ?? task.evidenceLongitude,
    evidenceCapturedAt: data.evidenceCapturedAt ?? task.evidenceCapturedAt ?? new Date().toISOString(),
  });

  if (completed.source === "milestone_kpi" && completed.kpiId) {
    applyCompletionToProjectKpi(completed);
    void syncMilestoneToFinanceApi(completed);
  }

  return completed;
}

function syncMilestoneToFinanceApi(task: ActivityTask) {
  if (!task.milestoneId || typeof fetch === "undefined") return;
  const ben = getTaskBeneficiaryCount(task);
  fetch("/api/ngo-integrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "sync_milestone_from_activity",
      legacyProjectId: task.projectId,
      legacyMilestoneId: task.milestoneId,
      activities: 1,
      beneficiaries: ben,
    }),
  }).catch(() => {});
}

/** Apply offline-queued task completion (localStorage sync — no server API). */
export function applyOfflineTaskComplete(payload: Record<string, unknown>): void {
  const taskId = payload.taskId as string;
  if (!taskId) throw new Error("Missing taskId");

  const task = loadActivityTasks().find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");

  if (task.status === "assigned") {
    startTask(taskId);
  }

  completeTask(taskId, {
    beneficiaryCount: payload.beneficiaryCount as number | undefined,
    beneficiaries: payload.beneficiaries as BeneficiaryEntry[] | undefined,
    photoAttachments: payload.photoAttachments as FileAttachment[] | undefined,
    pdfAttachments: payload.pdfAttachments as FileAttachment[] | undefined,
    notes: payload.notes as string | undefined,
    evidenceLatitude: payload.evidenceLatitude as number | undefined,
    evidenceLongitude: payload.evidenceLongitude as number | undefined,
    evidenceCapturedAt: payload.evidenceCapturedAt as string | undefined,
  });
}

/** Roll completed task counts into milestone KPI achievements. */
function applyCompletionToProjectKpi(task: ActivityTask) {
  const project = getProjectById(task.projectId);
  if (!project?.setup) return;

  const milestones = project.setup.milestones.map((milestone) => {
    if (task.milestoneId && milestone.id !== task.milestoneId) return milestone;
    return {
      ...milestone,
      kpis: milestone.kpis.map((kpi) => {
        if (kpi.id !== task.kpiId) return kpi;
        const activityDelta = 1;
        const beneficiaryDelta = getTaskBeneficiaryCount(task);
        return {
          ...kpi,
          achievedActivityCount:
            (kpi.achievedActivityCount ?? 0) + activityDelta,
          achievedBeneficiaries:
            (kpi.achievedBeneficiaries ?? 0) + beneficiaryDelta,
        };
      }),
    };
  });

  upsertProject({
    ...project,
    setup: { ...project.setup, milestones },
  });
}

/** Summary stats for additional activities (report coverage beyond milestones). */
export function getAdditionalActivityCoverage(projectId?: string) {
  const tasks = loadActivityTasks().filter(
    (t) =>
      t.source === "additional" &&
      t.status === "completed" &&
      (!projectId || t.projectId === projectId)
  );
  return {
    count: tasks.length,
    beneficiaries: tasks.reduce((sum, t) => sum + getTaskBeneficiaryCount(t), 0),
  };
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function createAttachmentFromFile(file: File): Promise<FileAttachment> {
  const dataUrl = await readFileAsDataUrl(file);
  return {
    id: createAttachmentId(),
    name: file.name,
    mimeType: file.type,
    dataUrl,
    uploadedAt: new Date().toISOString(),
  };
}

export function normalizeMobile(value: string): string {
  return value.replace(/\D/g, "").slice(-10);
}

export interface PriorBeneficiaryMatch {
  entry: BeneficiaryEntry;
  source: "activity" | "portal";
  sourceLabel: string;
  taskTitle?: string;
  taskDate?: string;
}

/** Find beneficiaries previously recorded in completed/active activity tasks. */
export function findBeneficiariesFromActivities(
  mobile: string,
  excludeTaskId?: string
): PriorBeneficiaryMatch[] {
  const needle = normalizeMobile(mobile);
  if (needle.length < 4) return [];

  const seen = new Set<string>();
  const matches: PriorBeneficiaryMatch[] = [];

  for (const task of loadActivityTasks()) {
    if (excludeTaskId && task.id === excludeTaskId) continue;
    if (task.status === "canceled") continue;

    for (const ben of task.beneficiaries ?? []) {
      const benMobile = ben.contact ? normalizeMobile(ben.contact) : "";
      if (!benMobile || !benMobile.includes(needle)) continue;
      const key = `${benMobile}-${ben.name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      matches.push({
        entry: ben,
        source: "activity",
        sourceLabel: task.activityCode ?? task.title,
        taskTitle: task.title,
        taskDate: task.completedAt ?? task.scheduledDate ?? task.updatedAt,
      });
    }
  }

  return matches;
}
