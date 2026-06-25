import {
  isSetupComplete,
  MilestoneKPI,
  ProjectMilestone,
  ProjectProposal,
} from "@/lib/projects";

export type AchievementStatusBucket =
  | "ALL"
  | "COMPLETE"
  | "ON_TRACK"
  | "AT_RISK"
  | "BEHIND"
  | "NO_DATA";

export type AchievementStatus = Exclude<AchievementStatusBucket, "ALL">;

export interface KpiAchievement {
  kpiId: string;
  kpiName: string;
  milestoneId: string;
  milestoneName: string;
  trackingMode: MilestoneKPI["trackingMode"];
  targetActivities: number;
  achievedActivities: number;
  targetBeneficiaries: number;
  achievedBeneficiaries: number;
  activityPct: number | null;
  beneficiaryPct: number | null;
  overallPct: number | null;
  status: AchievementStatus;
}

export interface ProjectAchievement {
  projectId: string;
  projectTitle: string;
  location: string;
  sdgGoals: number[];
  targetActivities: number;
  achievedActivities: number;
  targetBeneficiaries: number;
  achievedBeneficiaries: number;
  activityPct: number | null;
  beneficiaryPct: number | null;
  overallPct: number | null;
  status: AchievementStatus;
  kpis: KpiAchievement[];
  milestones: {
    milestoneId: string;
    milestoneName: string;
    targetActivities: number;
    achievedActivities: number;
    targetBeneficiaries: number;
    achievedBeneficiaries: number;
    overallPct: number | null;
    status: AchievementStatus;
  }[];
}

export interface AchievementOverview {
  totalProjects: number;
  activeProjects: number;
  targetActivities: number;
  achievedActivities: number;
  targetBeneficiaries: number;
  achievedBeneficiaries: number;
  activityPct: number | null;
  beneficiaryPct: number | null;
  overallPct: number | null;
  byStatus: Record<AchievementStatus, number>;
  bySdg: {
    sdgId: number;
    projectCount: number;
    targetBeneficiaries: number;
    achievedBeneficiaries: number;
    overallPct: number | null;
  }[];
}

export interface AchievementFilters {
  status: AchievementStatusBucket;
  projectId: string;
  sdgGoal: number | "ALL";
  query: string;
}

export const ACHIEVEMENT_STATUS_LABELS: Record<AchievementStatus, string> = {
  COMPLETE: "Complete",
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  BEHIND: "Behind",
  NO_DATA: "No data",
};

export const ACHIEVEMENT_STATUS_STYLES: Record<
  AchievementStatus,
  { dot: string; badge: string; chart: string }
> = {
  COMPLETE: {
    dot: "bg-brand-mist",
    badge: "bg-brand-mist text-brand-teal-dark ring-brand-teal/25",
    chart: "#10b981",
  },
  ON_TRACK: {
    dot: "bg-sky-500",
    badge: "bg-sky-50 text-sky-800 ring-sky-200",
    chart: "#0ea5e9",
  },
  AT_RISK: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    chart: "#f59e0b",
  },
  BEHIND: {
    dot: "bg-orange-500",
    badge: "bg-orange-50 text-orange-800 ring-orange-200",
    chart: "#f97316",
  },
  NO_DATA: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600 ring-slate-200",
    chart: "#94a3b8",
  },
};

function pct(achieved: number, target: number): number | null {
  if (target <= 0) return null;
  return Math.min(100, Math.round((achieved / target) * 100));
}

function combinePct(activityPct: number | null, beneficiaryPct: number | null): number | null {
  const parts = [activityPct, beneficiaryPct].filter((v): v is number => v !== null);
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((sum, v) => sum + v, 0) / parts.length);
}

export function classifyAchievementPct(
  overallPct: number | null,
  hasAnyAchieved: boolean
): AchievementStatus {
  if (overallPct === null) return "NO_DATA";
  if (!hasAnyAchieved) return "NO_DATA";
  if (overallPct >= 100) return "COMPLETE";
  if (overallPct >= 80) return "ON_TRACK";
  if (overallPct >= 50) return "AT_RISK";
  return "BEHIND";
}

function kpiTargets(kpi: MilestoneKPI) {
  const targetActivities =
    kpi.trackingMode === "activities" || kpi.trackingMode === "combined" ? kpi.activityCount : 0;
  const targetBeneficiaries =
    kpi.trackingMode === "beneficiaries" || kpi.trackingMode === "combined"
      ? kpi.beneficiaryCount
      : 0;
  return {
    targetActivities,
    targetBeneficiaries,
    achievedActivities: kpi.achievedActivityCount ?? 0,
    achievedBeneficiaries: kpi.achievedBeneficiaries ?? 0,
  };
}

function rollupMilestone(milestone: ProjectMilestone) {
  let targetActivities = 0;
  let achievedActivities = 0;
  let targetBeneficiaries = 0;
  let achievedBeneficiaries = 0;

  for (const kpi of milestone.kpis) {
    const t = kpiTargets(kpi);
    targetActivities += t.targetActivities;
    achievedActivities += t.achievedActivities;
    targetBeneficiaries += t.targetBeneficiaries;
    achievedBeneficiaries += t.achievedBeneficiaries;
  }

  if (milestone.beneficiaryMode === "milestone_total") {
    targetBeneficiaries += milestone.beneficiarySummary?.totalBeneficiaries ?? 0;
  }

  const activityPct = pct(achievedActivities, targetActivities);
  const beneficiaryPct = pct(achievedBeneficiaries, targetBeneficiaries);
  const overallPct = combinePct(activityPct, beneficiaryPct);
  const hasAnyAchieved = achievedActivities > 0 || achievedBeneficiaries > 0;

  return {
    milestoneId: milestone.id,
    milestoneName: milestone.name,
    targetActivities,
    achievedActivities,
    targetBeneficiaries,
    achievedBeneficiaries,
    activityPct,
    beneficiaryPct,
    overallPct,
    status: classifyAchievementPct(overallPct, hasAnyAchieved),
  };
}

export function computeProjectAchievement(project: ProjectProposal): ProjectAchievement | null {
  if (project.status !== "APPROVED" || !isSetupComplete(project) || !project.setup) {
    return null;
  }

  const kpis: KpiAchievement[] = [];
  const milestones = project.setup.milestones.map((milestone) => {
    for (const kpi of milestone.kpis) {
      const t = kpiTargets(kpi);
      const activityPct = pct(t.achievedActivities, t.targetActivities);
      const beneficiaryPct = pct(t.achievedBeneficiaries, t.targetBeneficiaries);
      const overallPct = combinePct(activityPct, beneficiaryPct);
      const hasAnyAchieved = t.achievedActivities > 0 || t.achievedBeneficiaries > 0;

      kpis.push({
        kpiId: kpi.id,
        kpiName: kpi.name,
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        trackingMode: kpi.trackingMode,
        targetActivities: t.targetActivities,
        achievedActivities: t.achievedActivities,
        targetBeneficiaries: t.targetBeneficiaries,
        achievedBeneficiaries: t.achievedBeneficiaries,
        activityPct,
        beneficiaryPct,
        overallPct,
        status: classifyAchievementPct(overallPct, hasAnyAchieved),
      });
    }
    return rollupMilestone(milestone);
  });

  const targetActivities = milestones.reduce((s, m) => s + m.targetActivities, 0);
  const achievedActivities = milestones.reduce((s, m) => s + m.achievedActivities, 0);
  const targetBeneficiaries = milestones.reduce((s, m) => s + m.targetBeneficiaries, 0);
  const achievedBeneficiaries = milestones.reduce((s, m) => s + m.achievedBeneficiaries, 0);
  const activityPct = pct(achievedActivities, targetActivities);
  const beneficiaryPct = pct(achievedBeneficiaries, targetBeneficiaries);
  const overallPct = combinePct(activityPct, beneficiaryPct);
  const hasAnyAchieved = achievedActivities > 0 || achievedBeneficiaries > 0;

  return {
    projectId: project.id,
    projectTitle: project.title,
    location: project.location,
    sdgGoals: project.sdgGoals ?? [],
    targetActivities,
    achievedActivities,
    targetBeneficiaries,
    achievedBeneficiaries,
    activityPct,
    beneficiaryPct,
    overallPct,
    status: classifyAchievementPct(overallPct, hasAnyAchieved),
    kpis,
    milestones,
  };
}

export function computeAllProjectAchievements(projects: ProjectProposal[]): ProjectAchievement[] {
  return projects
    .map(computeProjectAchievement)
    .filter((row): row is ProjectAchievement => row !== null);
}

export function computeAchievementOverview(
  achievements: ProjectAchievement[]
): AchievementOverview {
  const byStatus: AchievementOverview["byStatus"] = {
    COMPLETE: 0,
    ON_TRACK: 0,
    AT_RISK: 0,
    BEHIND: 0,
    NO_DATA: 0,
  };

  let targetActivities = 0;
  let achievedActivities = 0;
  let targetBeneficiaries = 0;
  let achievedBeneficiaries = 0;

  for (const row of achievements) {
    byStatus[row.status] += 1;
    targetActivities += row.targetActivities;
    achievedActivities += row.achievedActivities;
    targetBeneficiaries += row.targetBeneficiaries;
    achievedBeneficiaries += row.achievedBeneficiaries;
  }

  const sdgMap = new Map<
    number,
    { projectCount: number; targetBeneficiaries: number; achievedBeneficiaries: number }
  >();

  for (const row of achievements) {
    for (const sdgId of row.sdgGoals) {
      const existing = sdgMap.get(sdgId) ?? {
        projectCount: 0,
        targetBeneficiaries: 0,
        achievedBeneficiaries: 0,
      };
      existing.projectCount += 1;
      existing.targetBeneficiaries += row.targetBeneficiaries;
      existing.achievedBeneficiaries += row.achievedBeneficiaries;
      sdgMap.set(sdgId, existing);
    }
  }

  const bySdg = Array.from(sdgMap.entries())
    .map(([sdgId, data]) => ({
      sdgId,
      projectCount: data.projectCount,
      targetBeneficiaries: data.targetBeneficiaries,
      achievedBeneficiaries: data.achievedBeneficiaries,
      overallPct: pct(data.achievedBeneficiaries, data.targetBeneficiaries),
    }))
    .sort((a, b) => a.sdgId - b.sdgId);

  const activityPct = pct(achievedActivities, targetActivities);
  const beneficiaryPct = pct(achievedBeneficiaries, targetBeneficiaries);

  return {
    totalProjects: achievements.length,
    activeProjects: achievements.length,
    targetActivities,
    achievedActivities,
    targetBeneficiaries,
    achievedBeneficiaries,
    activityPct,
    beneficiaryPct,
    overallPct: combinePct(activityPct, beneficiaryPct),
    byStatus,
    bySdg,
  };
}

export function filterAchievements(
  achievements: ProjectAchievement[],
  filters: AchievementFilters
): ProjectAchievement[] {
  const q = filters.query.trim().toLowerCase();

  return achievements.filter((row) => {
    if (filters.status !== "ALL" && row.status !== filters.status) return false;
    if (filters.projectId !== "ALL" && row.projectId !== filters.projectId) return false;
    if (filters.sdgGoal !== "ALL" && !row.sdgGoals.includes(filters.sdgGoal)) return false;

    if (q) {
      const haystack = [
        row.projectTitle,
        row.location,
        ...row.kpis.map((k) => k.kpiName),
        ...row.milestones.map((m) => m.milestoneName),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function overviewFromFiltered(
  filtered: ProjectAchievement[]
): AchievementOverview {
  return computeAchievementOverview(filtered);
}
