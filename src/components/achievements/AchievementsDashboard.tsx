"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Filter, Search, Target } from "lucide-react";
import { AchievementExportActions } from "@/components/achievements/AchievementExportActions";
import {
  HorizontalBarChart,
  MilestoneBreakdownChart,
  ProgressBar,
  SdgAchievementChart,
  StatusBadge,
  StatusDonutChart,
} from "@/components/achievements/AchievementCharts";
import { Card } from "@/components/ui/Card";
import { PageHeader, PageShell } from "@/components/ui/PageHeader";
import { AttendancePunchWidget } from "@/components/hr/AttendancePunchWidget";
import {
  AchievementFilters,
  AchievementStatusBucket,
  ACHIEVEMENT_STATUS_LABELS,
  computeAllProjectAchievements,
  filterAchievements,
  overviewFromFiltered,
} from "@/lib/achievements";
import { loadProjects, ProjectProposal } from "@/lib/projects";
import { cn } from "@/lib/utils";

interface AchievementsDashboardProps {
  userName: string;
  canExport?: boolean;
  showPunch?: boolean;
  onBackToWork?: () => void;
}

const DEFAULT_FILTERS: AchievementFilters = {
  status: "ALL",
  projectId: "ALL",
  sdgGoal: "ALL",
  query: "",
};

export function AchievementsDashboard({ userName, canExport = false, showPunch = false, onBackToWork }: AchievementsDashboardProps) {
  const [projects, setProjects] = useState<ProjectProposal[]>([]);
  const [filters, setFilters] = useState<AchievementFilters>(DEFAULT_FILTERS);

  useEffect(() => {
    function refresh() {
      setProjects(loadProjects());
    }
    refresh();
    window.addEventListener("projects-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("projects-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const allAchievements = useMemo(() => computeAllProjectAchievements(projects), [projects]);

  const filtered = useMemo(
    () => filterAchievements(allAchievements, filters),
    [allAchievements, filters]
  );

  const fullOverview = useMemo(() => overviewFromFiltered(allAchievements), [allAchievements]);
  const overview = useMemo(() => overviewFromFiltered(filtered), [filtered]);

  const projectOptions = useMemo(
    () =>
      allAchievements.map((a) => ({
        id: a.projectId,
        title: a.projectTitle,
      })),
    [allAchievements]
  );

  function setStatus(status: AchievementStatusBucket) {
    setFilters((prev) => ({ ...prev, status }));
  }

  function setProjectId(projectId: string) {
    setFilters((prev) => ({ ...prev, projectId }));
  }

  function setSdgGoal(sdgGoal: number | "ALL") {
    setFilters((prev) => ({ ...prev, sdgGoal }));
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  const hasActiveFilters =
    filters.status !== "ALL" ||
    filters.projectId !== "ALL" ||
    filters.sdgGoal !== "ALL" ||
    filters.query.trim().length > 0;

  const statusCards: { key: AchievementStatusBucket; label: string; value: number }[] = [
    { key: "ALL", label: "All active", value: fullOverview.activeProjects },
    { key: "COMPLETE", label: ACHIEVEMENT_STATUS_LABELS.COMPLETE, value: fullOverview.byStatus.COMPLETE },
    { key: "ON_TRACK", label: ACHIEVEMENT_STATUS_LABELS.ON_TRACK, value: fullOverview.byStatus.ON_TRACK },
    { key: "AT_RISK", label: ACHIEVEMENT_STATUS_LABELS.AT_RISK, value: fullOverview.byStatus.AT_RISK },
    { key: "BEHIND", label: ACHIEVEMENT_STATUS_LABELS.BEHIND, value: fullOverview.byStatus.BEHIND },
    { key: "NO_DATA", label: ACHIEVEMENT_STATUS_LABELS.NO_DATA, value: fullOverview.byStatus.NO_DATA },
  ];

  return (
    <PageShell>
      {showPunch && <AttendancePunchWidget userName={userName} />}

      <PageHeader
        eyebrow="Impact"
        title="Project achievements"
        description={`Track progress across all active projects, ${userName}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {onBackToWork && (
              <button
                type="button"
                onClick={onBackToWork}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                ← Back to home
              </button>
            )}
            {canExport ? (
              <AchievementExportActions
                projects={projects}
                filters={filters}
                disabled={filtered.length === 0}
              />
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {statusCards.map((stat) => (
          <button
            key={stat.key}
            type="button"
            onClick={() => setStatus(stat.key)}
            className={cn(
              "rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors",
              filters.status === stat.key
                ? "border-brand-teal ring-1 ring-brand-teal/30"
                : "hover:border-slate-300"
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{stat.value}</p>
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search projects, milestones, KPIs…"
            value={filters.query}
            onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Project
            <select
              value={filters.projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="min-w-[10rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
            >
              <option value="ALL">All projects</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 self-end rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Filter className="h-4 w-4" />
              Clear filters
            </button>
          )}
        </div>

        <p className="text-sm text-slate-500 lg:ml-auto lg:self-center">
          Showing {filtered.length} of {allAchievements.length} active projects
        </p>
      </div>

      {allAchievements.length === 0 ? (
        <Card className="flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <Target className="h-5 w-5" />
          </div>
          <p className="font-medium text-slate-900">No active projects yet</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Approve a project and complete milestone setup to start tracking achievements here.
          </p>
          <Link
            href="/dashboard/projects"
            className="mt-4 inline-flex items-center rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-red-dark"
          >
            Go to Projects
          </Link>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Overall progress
              </h2>
              <div className="mt-4 space-y-4">
                <ProgressBar
                  label="Activities"
                  achieved={overview.achievedActivities}
                  target={overview.targetActivities}
                  pct={overview.activityPct}
                />
                <ProgressBar
                  label="Beneficiaries"
                  achieved={overview.achievedBeneficiaries}
                  target={overview.targetBeneficiaries}
                  pct={overview.beneficiaryPct}
                  color="#0ea5e9"
                />
                <div className="rounded-lg bg-brand-mist px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-teal-dark">
                    Combined achievement
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-brand-teal-dark">
                    {overview.overallPct !== null ? `${overview.overallPct}%` : "—"}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="lg:col-span-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Status distribution
              </h2>
              <p className="mt-1 text-xs text-slate-400">Click a segment to filter</p>
              <div className="mt-4">
                <StatusDonutChart
                  byStatus={overview.byStatus}
                  activeStatus={filters.status}
                  onSelect={setStatus}
                />
              </div>
            </Card>

            <Card className="lg:col-span-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                SDG achievement
              </h2>
              <p className="mt-1 text-xs text-slate-400">Click a goal to filter</p>
              <div className="mt-4 max-h-64 overflow-y-auto">
                <SdgAchievementChart
                  bySdg={overview.bySdg}
                  activeSdg={filters.sdgGoal}
                  onSelect={setSdgGoal}
                />
              </div>
            </Card>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand-teal" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Project progress
                </h2>
              </div>
              <HorizontalBarChart
                items={filtered.map((p) => ({
                  id: p.projectId,
                  label: p.projectTitle,
                  sublabel: p.location || undefined,
                  pct: p.overallPct,
                  value: p.overallPct ?? 0,
                }))}
              />
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-sky-600" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Milestone breakdown
                </h2>
              </div>
              <MilestoneBreakdownChart achievements={filtered} />
            </Card>
          </div>

          <Card>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              KPI detail
            </h2>
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No projects match the current filters.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">Project</th>
                      <th className="pb-3 pr-4 font-medium">Milestone</th>
                      <th className="pb-3 pr-4 font-medium">KPI</th>
                      <th className="pb-3 pr-4 font-medium">Activities</th>
                      <th className="pb-3 pr-4 font-medium">Beneficiaries</th>
                      <th className="pb-3 pr-4 font-medium">Progress</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.flatMap((project) =>
                      project.kpis.map((kpi) => (
                        <tr
                          key={`${project.projectId}-${kpi.kpiId}`}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="py-3 pr-4">
                            <Link
                              href={`/dashboard/projects/${project.projectId}`}
                              className="font-medium text-brand-teal-dark hover:underline"
                            >
                              {project.projectTitle}
                            </Link>
                          </td>
                          <td className="py-3 pr-4 text-slate-600">{kpi.milestoneName}</td>
                          <td className="py-3 pr-4 text-slate-600">{kpi.kpiName || "—"}</td>
                          <td className="py-3 pr-4 tabular-nums text-slate-600">
                            {kpi.achievedActivities.toLocaleString("en-IN")} /{" "}
                            {kpi.targetActivities.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 pr-4 tabular-nums text-slate-600">
                            {kpi.achievedBeneficiaries.toLocaleString("en-IN")} /{" "}
                            {kpi.targetBeneficiaries.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 pr-4 font-semibold tabular-nums text-slate-800">
                            {kpi.overallPct !== null ? `${kpi.overallPct}%` : "—"}
                          </td>
                          <td className="py-3">
                            <StatusBadge status={kpi.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </PageShell>
  );
}
