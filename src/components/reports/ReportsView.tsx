"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { ReportType } from "@/lib/aiReport";
import { loadProjects, ProjectProposal } from "@/lib/projects";
import {
  ActivityTask,
  ActivityTaskStatus,
  ActivityWorkType,
  getTaskBeneficiaryCount,
  loadActivityTasks,
  TASK_STATUS_LABELS,
  WORK_TYPE_LABELS,
} from "@/lib/activities";
import {
  computeAllProjectAchievements,
  filterAchievements,
  overviewFromFiltered,
} from "@/lib/achievements";
import { BeneficiaryCategory } from "@/generated/prisma/enums";
import { BENEFICIARY_CATEGORY_LABELS } from "@/lib/service-portal-utils";
import { MeetingExportRow } from "@/lib/meetingExport";
import { BeneficiaryExportRow } from "@/lib/beneficiaryExport";
import {
  exportAllFilteredData,
  exportReportByFormat,
  ReportExportFormat,
  ReportExportContext,
} from "@/lib/reportExport";
import { ReportDashboardCharts } from "@/components/reports/ReportDashboardCharts";
import { DashboardViewId } from "@/lib/report-dashboards";

interface ReportsViewProps {
  canExport: boolean;
}

type ReportsTab = "dashboard" | "export" | "ai";

const REPORT_TYPES: { id: ReportType; label: string; description: string }[] = [
  {
    id: "combined",
    label: "Combined",
    description: "Cross-module overview for donors and management",
  },
  {
    id: "beneficiaries",
    label: "Beneficiaries",
    description: "Enrollment, demographics, and service delivery",
  },
  {
    id: "activities",
    label: "Field Activities",
    description: "Camps, drives, and field work tasks",
  },
  {
    id: "meetings",
    label: "Meetings",
    description: "Calendar requests and scheduled events",
  },
  {
    id: "achievements",
    label: "KPI Achievements",
    description: "Project milestone progress and SDG impact",
  },
];

const TABS: { id: ReportsTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboards", icon: LayoutDashboard },
  { id: "export", label: "Data Export", icon: Database },
  { id: "ai", label: "AI Reports", icon: Sparkles },
];

const EXPORT_FORMATS: { id: ReportExportFormat; label: string; icon: typeof FileSpreadsheet }[] = [
  { id: "excel", label: "Excel (.xlsx)", icon: FileSpreadsheet },
  { id: "csv", label: "CSV", icon: FileText },
  { id: "pdf", label: "PDF summary", icon: Download },
  { id: "word", label: "Word (.docx)", icon: FileText },
];

export function ReportsView({ canExport }: ReportsViewProps) {
  const [activeTab, setActiveTab] = useState<ReportsTab>("dashboard");
  const [reportType, setReportType] = useState<ReportType>("combined");
  const [dashboardView, setDashboardView] = useState<DashboardViewId>("impact");
  const [projects, setProjects] = useState<ProjectProposal[]>([]);
  const [projectId, setProjectId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [workType, setWorkType] = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [caseStudyOnly, setCaseStudyOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [sdgGoal, setSdgGoal] = useState<number | "">("");

  const [beneficiaryCount, setBeneficiaryCount] = useState(0);
  const [meetingCount, setMeetingCount] = useState(0);
  const [dashboardBeneficiaries, setDashboardBeneficiaries] = useState<BeneficiaryExportRow[]>([]);
  const [dashboardMeetings, setDashboardMeetings] = useState<MeetingExportRow[]>([]);

  const [aiNarrative, setAiNarrative] = useState("");
  const [aiProvider, setAiProvider] = useState<"groq" | "gemini" | "template" | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState<ReportExportFormat | "all" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setProjects(loadProjects());
    const refresh = () => setProjects(loadProjects());
    window.addEventListener("projects-updated", refresh);
    return () => window.removeEventListener("projects-updated", refresh);
  }, []);

  const activities = useMemo(() => {
    let list = loadActivityTasks();
    if (projectId) list = list.filter((t) => t.projectId === projectId);
    if (from) list = list.filter((t) => !t.scheduledDate || t.scheduledDate.slice(0, 10) >= from);
    if (to) list = list.filter((t) => !t.scheduledDate || t.scheduledDate.slice(0, 10) <= to);
    if (status) list = list.filter((t) => t.status === status);
    if (workType) list = list.filter((t) => t.workType === workType);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) || t.projectTitle.toLowerCase().includes(q)
      );
    }
    return list;
  }, [projectId, from, to, status, workType, query]);

  const achievementOverview = useMemo(() => {
    const all = computeAllProjectAchievements(projects);
    const filtered = filterAchievements(all, {
      status: "ALL",
      projectId: projectId || "ALL",
      sdgGoal: sdgGoal === "" ? "ALL" : sdgGoal,
      query,
    });
    return overviewFromFiltered(filtered);
  }, [projects, projectId, sdgGoal, query]);

  const achievementFilters = useMemo(
    () => ({
      status: "ALL" as const,
      projectId: projectId || "ALL",
      sdgGoal: sdgGoal === "" ? ("ALL" as const) : sdgGoal,
      query,
    }),
    [projectId, sdgGoal, query]
  );

  const activityStats = useMemo(
    () => ({
      total: activities.length,
      completed: activities.filter((t) => t.status === "completed").length,
      beneficiaries: activities.reduce((s, t) => s + getTaskBeneficiaryCount(t), 0),
    }),
    [activities]
  );

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (projectId) {
      parts.push(`Project: ${projects.find((p) => p.id === projectId)?.title ?? projectId}`);
    }
    if (from) parts.push(`From ${from}`);
    if (to) parts.push(`To ${to}`);
    if (query.trim()) parts.push(`Search: "${query.trim()}"`);
    return parts.length ? parts.join(" · ") : "All data (no filters)";
  }, [projectId, from, to, query, projects]);

  useEffect(() => {
    async function loadCounts() {
      try {
        const benParams = new URLSearchParams({ export: "1" });
        if (projectId) benParams.set("projectId", projectId);
        if (category) benParams.set("category", category);
        if (urgentOnly) benParams.set("urgentOnly", "1");
        if (caseStudyOnly) benParams.set("caseStudyOnly", "1");
        if (from) benParams.set("from", from);
        if (to) benParams.set("to", to);
        if (query.trim()) benParams.set("q", query.trim());

        const meetParams = new URLSearchParams({ all: "1" });
        if (from) meetParams.set("from", from);
        if (to) meetParams.set("to", to);

        const [benRes, meetRes] = await Promise.all([
          fetch(`/api/beneficiaries?${benParams}`).catch(() => null),
          fetch(`/api/calendar/requests?${meetParams}`).catch(() => null),
        ]);

        if (benRes?.ok) {
          const data = await benRes.json();
          const rows = (data.beneficiaries as BeneficiaryExportRow[]) ?? [];
          setDashboardBeneficiaries(rows);
          setBeneficiaryCount(rows.length);
        }
        if (meetRes?.ok) {
          const data = await meetRes.json();
          let rows = data.requests as MeetingExportRow[];
          if (projectId) rows = rows.filter((r) => r.projectId === projectId);
          setDashboardMeetings(rows);
          setMeetingCount(rows.length);
        }
      } catch {
        /* counts are optional for dashboard */
      }
    }
    loadCounts();
  }, [projectId, from, to, category, urgentOnly, caseStudyOnly, query]);

  async function fetchBeneficiariesForExport(): Promise<BeneficiaryExportRow[]> {
    const params = new URLSearchParams({ export: "1", includeDeliveries: "1" });
    if (projectId) params.set("projectId", projectId);
    if (category) params.set("category", category);
    if (urgentOnly) params.set("urgentOnly", "1");
    if (caseStudyOnly) params.set("caseStudyOnly", "1");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (query.trim()) params.set("q", query.trim());

    const res = await fetch(`/api/beneficiaries?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load beneficiaries");
    return (data.beneficiaries as BeneficiaryExportRow[]).map((b) => ({
      ...b,
      projectTitle: projects.find((p) => p.id === b.projectId)?.title,
    }));
  }

  async function fetchMeetingsForExport(): Promise<MeetingExportRow[]> {
    const params = new URLSearchParams({ all: "1" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status.toUpperCase());
    if (workType) params.set("workType", workType.toUpperCase());

    const res = await fetch(`/api/calendar/requests?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load meetings");

    let rows = data.requests as MeetingExportRow[];
    if (projectId) rows = rows.filter((r) => r.projectId === projectId);
    return rows.map((r) => ({
      ...r,
      projectTitle: projects.find((p) => p.id === r.projectId)?.title,
    }));
  }

  async function buildExportContext(): Promise<ReportExportContext> {
    const filterLabel = reportType;
    const [beneficiaries, meetings] = await Promise.all([
      reportType === "activities" || reportType === "achievements"
        ? Promise.resolve([] as BeneficiaryExportRow[])
        : fetchBeneficiariesForExport(),
      reportType === "beneficiaries" || reportType === "activities" || reportType === "achievements"
        ? Promise.resolve([] as MeetingExportRow[])
        : fetchMeetingsForExport(),
    ]);

    return {
      reportType,
      filterLabel,
      beneficiaries,
      activities: reportType === "beneficiaries" || reportType === "meetings" ? [] : activities,
      meetings,
      projects,
      achievementFilters,
      summary: {
        beneficiaryCount: beneficiaries.length || beneficiaryCount,
        activityCount: activities.length,
        meetingCount: meetings.length || meetingCount,
        completedActivities: activityStats.completed,
        beneficiariesReached: activityStats.beneficiaries,
        kpiPct: achievementOverview.overallPct,
      },
    };
  }

  async function handleExport(format: ReportExportFormat | "all") {
    if (!canExport) return;
    setExporting(format);
    setError("");
    try {
      const ctx = await buildExportContext();
      if (format === "all") {
        await exportAllFilteredData({
          ...ctx,
          beneficiaries: await fetchBeneficiariesForExport().catch(() => []),
          meetings: await fetchMeetingsForExport().catch(() => []),
          activities: loadActivityTasks().filter((t) => {
            if (projectId && t.projectId !== projectId) return false;
            if (from && t.scheduledDate && t.scheduledDate.slice(0, 10) < from) return false;
            if (to && t.scheduledDate && t.scheduledDate.slice(0, 10) > to) return false;
            return true;
          }),
        });
      } else {
        await exportReportByFormat(ctx, format);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  const buildActivityPayload = useCallback(
    () =>
      activities.map((t: ActivityTask) => ({
        id: t.id,
        title: t.title,
        projectTitle: t.projectTitle,
        workType: t.workType,
        status: t.status,
        scheduledDate: t.scheduledDate,
        completedAt: t.completedAt,
        beneficiaryCount: getTaskBeneficiaryCount(t),
        notes: t.notes,
      })),
    [activities]
  );

  async function handleGenerateAiReport() {
    setGenerating(true);
    setError("");
    setAiNarrative("");
    setAiProvider(null);

    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType,
          projectId: projectId || undefined,
          from: from || undefined,
          to: to || undefined,
          status: status || undefined,
          category: category || undefined,
          urgentOnly,
          caseStudyOnly,
          workType: workType || undefined,
          query: query || undefined,
          sdgGoal: sdgGoal === "" ? undefined : sdgGoal,
          activities: buildActivityPayload(),
          achievementSummary: {
            targetActivities: achievementOverview.targetActivities,
            achievedActivities: achievementOverview.achievedActivities,
            targetBeneficiaries: achievementOverview.targetBeneficiaries,
            achievedBeneficiaries: achievementOverview.achievedBeneficiaries,
            projectCount: achievementOverview.activeProjects,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Report generation failed");
      setAiNarrative(data.narrative);
      setAiProvider(data.provider);
      setActiveTab("ai");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function downloadNarrative(format: "md" | "txt") {
    const blob = new Blob([aiNarrative], {
      type: format === "md" ? "text/markdown" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ngo-report-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-brand-teal" />
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Interactive dashboards, filtered data exports in multiple formats, and AI narrative reports.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-b-2 border-brand-red text-brand-teal-dark"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {REPORT_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => setReportType(type.id)}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors",
              reportType === type.id
                ? "border-brand-teal bg-brand-mist ring-1 ring-brand-teal"
                : "border-slate-200 bg-white hover:border-slate-300"
            )}
          >
            <p className="font-semibold text-slate-900">{type.label}</p>
            <p className="mt-1 text-xs text-slate-500">{type.description}</p>
          </button>
        ))}
      </div>

      <Card className="p-5">
        <CardTitle className="text-base">Filters</CardTitle>
        <p className="mt-1 text-xs text-slate-500">{filterSummary}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Project</Label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || "Untitled"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>From date</Label>
            <Input type="date" className="mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To date</Label>
            <Input type="date" className="mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>Search</Label>
            <Input
              className="mt-1"
              placeholder="Name, title, keyword…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {(reportType === "beneficiaries" || reportType === "combined") && (
            <>
              <div>
                <Label>Category</Label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">All categories</option>
                  {(Object.keys(BENEFICIARY_CATEGORY_LABELS) as BeneficiaryCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {BENEFICIARY_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-end gap-4 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={urgentOnly}
                    onChange={(e) => setUrgentOnly(e.target.checked)}
                  />
                  Urgent cases only
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={caseStudyOnly}
                    onChange={(e) => setCaseStudyOnly(e.target.checked)}
                  />
                  Case studies only
                </label>
              </div>
            </>
          )}

          {(reportType === "activities" || reportType === "combined") && (
            <>
              <div>
                <Label>Activity status</Label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {(Object.keys(TASK_STATUS_LABELS) as ActivityTaskStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Work type</Label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value)}
                >
                  <option value="">All types</option>
                  {(Object.keys(WORK_TYPE_LABELS) as ActivityWorkType[]).map((w) => (
                    <option key={w} value={w}>
                      {WORK_TYPE_LABELS[w]}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {reportType === "achievements" && (
            <div>
              <Label>SDG Goal</Label>
              <Input
                type="number"
                min={1}
                max={17}
                className="mt-1"
                placeholder="All SDGs"
                value={sdgGoal}
                onChange={(e) =>
                  setSdgGoal(e.target.value ? parseInt(e.target.value, 10) : "")
                }
              />
            </div>
          )}
        </div>
      </Card>

      {activeTab === "dashboard" && (
        <ReportDashboardCharts
          dashboardView={dashboardView}
          onDashboardChange={setDashboardView}
          filterSummary={filterSummary}
          activities={activities}
          achievementOverview={achievementOverview}
          beneficiaries={dashboardBeneficiaries}
          meetings={dashboardMeetings}
        />
      )}

      {activeTab === "export" && (
        <Card className="p-5">
          <CardTitle className="text-base">Download filtered data</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Export the current report type and filters in your preferred format. Use &quot;Download
            all data&quot; for a single Excel workbook with every module.
          </p>

          {!canExport ? (
            <p className="mt-4 text-sm text-amber-700">
              You have view-only access. Contact an admin for export permissions.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {EXPORT_FORMATS.map((fmt) => {
                  const Icon = fmt.icon;
                  return (
                    <Button
                      key={fmt.id}
                      variant="secondary"
                      className="gap-1.5"
                      disabled={Boolean(exporting)}
                      onClick={() => handleExport(fmt.id)}
                    >
                      {exporting === fmt.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                      {exporting === fmt.id ? "Exporting…" : fmt.label}
                    </Button>
                  );
                })}
              </div>

              <Button
                className="gap-1.5"
                disabled={Boolean(exporting)}
                onClick={() => handleExport("all")}
              >
                {exporting === "all" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                {exporting === "all" ? "Preparing…" : "Download all data (Excel workbook)"}
              </Button>

              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-800">Export preview</p>
                <ul className="mt-2 space-y-1">
                  <li>Report scope: {reportType}</li>
                  <li>Activities in filter: {activities.length}</li>
                  <li>Beneficiaries (loaded): {beneficiaryCount}</li>
                  <li>Meetings (loaded): {meetingCount}</li>
                </ul>
              </div>
            </div>
          )}
        </Card>
      )}

      {activeTab === "ai" && (
        <div className="space-y-4">
          <Card className="p-5">
            <CardTitle className="text-base">AI narrative report</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Generate a donor-ready narrative from your filtered data using AI or a built-in
              template.
            </p>
            <Button
              className="mt-4 gap-1.5"
              disabled={generating}
              onClick={handleGenerateAiReport}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generating ? "Generating…" : "Generate AI Report"}
            </Button>
          </Card>

          {aiNarrative && (
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Generated Report</CardTitle>
                  <p className="mt-1 text-xs text-slate-500">
                    Provider:{" "}
                    {aiProvider === "groq"
                      ? "Groq (Llama — free tier)"
                      : aiProvider === "gemini"
                        ? "Google Gemini (free tier)"
                        : "Built-in template (add GROQ_API_KEY or GEMINI_API_KEY for AI)"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => downloadNarrative("md")}
                  >
                    <Download className="h-4 w-4" />
                    Download .md
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => downloadNarrative("txt")}
                  >
                    <FileText className="h-4 w-4" />
                    Download .txt
                  </Button>
                </div>
              </div>
              <pre className="mt-4 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-800">
                {aiNarrative}
              </pre>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
