"use client";

import { type ReactNode, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/achievements/AchievementCharts";
import { cn } from "@/lib/utils";
import {
  ActivityTask,
  TASK_STATUS_LABELS,
  WORK_TYPE_LABELS,
} from "@/lib/activities";
import {
  ACHIEVEMENT_STATUS_LABELS,
  AchievementOverview,
  AchievementStatus,
} from "@/lib/achievements";
import { BeneficiaryExportRow } from "@/lib/beneficiaryExport";
import { MeetingExportRow } from "@/lib/meetingExport";
import { BENEFICIARY_CATEGORY_LABELS } from "@/lib/service-portal-utils";
import { BeneficiaryCategory } from "@/generated/prisma/enums";
import {
  CHART_COLORS,
  DASHBOARD_VIEWS,
  DashboardViewId,
} from "@/lib/report-dashboards";

interface ReportDashboardChartsProps {
  dashboardView: DashboardViewId;
  onDashboardChange: (id: DashboardViewId) => void;
  filterSummary: string;
  activities: ActivityTask[];
  achievementOverview: AchievementOverview;
  beneficiaries: BeneficiaryExportRow[];
  meetings: MeetingExportRow[];
}

function countByLabel<T extends string>(
  items: T[],
  labels: Record<string, string>
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const name = labels[item] ?? item;
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <CardTitle className="text-sm">{title}</CardTitle>
      <div className="mt-4 h-64">{children}</div>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-500">{message}</div>
  );
}

export function ReportDashboardCharts({
  dashboardView,
  onDashboardChange,
  filterSummary,
  activities,
  achievementOverview,
  beneficiaries,
  meetings,
}: ReportDashboardChartsProps) {
  const statusData = useMemo(
    () => countByLabel(activities.map((a) => a.status), TASK_STATUS_LABELS as Record<string, string>),
    [activities]
  );
  const workTypeData = useMemo(
    () =>
      countByLabel(activities.map((a) => a.workType), WORK_TYPE_LABELS as Record<string, string>),
    [activities]
  );
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of beneficiaries) {
      const label =
        BENEFICIARY_CATEGORY_LABELS[b.category as BeneficiaryCategory] ?? b.category;
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [beneficiaries]);

  const meetingStatusData = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of meetings) {
      const status = String(m.status ?? "Unknown");
      map.set(status, (map.get(status) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [meetings]);

  const achievementStatusData = useMemo(() => {
    const order: AchievementStatus[] = ["COMPLETE", "ON_TRACK", "AT_RISK", "BEHIND", "NO_DATA"];
    return order
      .map((key) => ({
        name: ACHIEVEMENT_STATUS_LABELS[key],
        value: achievementOverview.byStatus[key],
      }))
      .filter((d) => d.value > 0);
  }, [achievementOverview.byStatus]);

  const monthlyActivityData = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of activities) {
      if (!task.scheduledDate) continue;
      const month = task.scheduledDate.slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([name, value]) => ({ name, value }));
  }, [activities]);

  const completed = activities.filter((a) => a.status === "completed").length;
  const urgentCount = beneficiaries.filter((b) => b.isUrgentCase).length;
  const caseStudyCount = beneficiaries.filter((b) => b.isCaseStudy).length;

  const overviewStats = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Beneficiaries" value={beneficiaries.length} />
      <StatCard
        label="Field Activities"
        value={activities.length}
        hint={`${completed} completed`}
      />
      <StatCard label="Meetings" value={meetings.length} />
      <StatCard
        label="KPI Progress"
        value={
          achievementOverview.overallPct != null ? `${achievementOverview.overallPct}%` : "—"
        }
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Interactive dashboards</h2>
        <p className="text-sm text-slate-500">
          Free built-in charts powered by Recharts — updates instantly with your filters.
        </p>
        <p className="mt-1 text-xs text-slate-500">{filterSummary}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DASHBOARD_VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => onDashboardChange(view.id)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              dashboardView === view.id
                ? "border-brand-teal bg-brand-mist text-brand-teal-dark"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            )}
          >
            <span className="font-medium">{view.label}</span>
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-500">
        {DASHBOARD_VIEWS.find((v) => v.id === dashboardView)?.description}
      </p>

      {dashboardView === "impact" && (
        <div className="space-y-4">
          {overviewStats}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Activities by status">
              {statusData.length === 0 ? (
                <EmptyChart message="No activities for current filters" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Beneficiaries by category">
              {categoryData.length === 0 ? (
                <EmptyChart message="No beneficiary data for current filters" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
          <ChartCard title="Activities over time (last 6 months)">
            {monthlyActivityData.length === 0 ? (
              <EmptyChart message="No dated activities in filter range" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyActivityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      {dashboardView === "beneficiaries" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total enrolled" value={beneficiaries.length} />
            <StatCard label="Urgent cases" value={urgentCount} />
            <StatCard label="Case studies" value={caseStudyCount} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Category distribution">
              {categoryData.length === 0 ? (
                <EmptyChart message="No beneficiaries for current filters" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" outerRadius={90}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Priority flags">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "Standard", value: beneficiaries.length - urgentCount - caseStudyCount },
                    { name: "Urgent", value: urgentCount },
                    { name: "Case study", value: caseStudyCount },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
      )}

      {dashboardView === "operations" && (
        <div className="space-y-4">
          {overviewStats}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Activity status">
              {statusData.length === 0 ? (
                <EmptyChart message="No activities for current filters" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Work types">
              {workTypeData.length === 0 ? (
                <EmptyChart message="No work type data" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workTypeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Meeting / calendar status" className="lg:col-span-2">
              {meetingStatusData.length === 0 ? (
                <EmptyChart message="No meetings for current filters" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={meetingStatusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </div>
      )}

      {dashboardView === "donor" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Activities achieved"
              value={`${achievementOverview.achievedActivities} / ${achievementOverview.targetActivities}`}
            />
            <StatCard
              label="Beneficiaries reached"
              value={`${achievementOverview.achievedBeneficiaries} / ${achievementOverview.targetBeneficiaries}`}
            />
            <StatCard label="Active projects" value={achievementOverview.activeProjects} />
            <StatCard
              label="Overall progress"
              value={
                achievementOverview.overallPct != null
                  ? `${achievementOverview.overallPct}%`
                  : "—"
              }
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Project achievement status">
              {achievementStatusData.length === 0 ? (
                <EmptyChart message="No achievement data — set up project milestones first" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={achievementStatusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={85}
                    >
                      {achievementStatusData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <Card className="p-5">
              <CardTitle className="text-sm">Outcome progress</CardTitle>
              <div className="mt-4 space-y-4">
                <ProgressBar
                  label="Activities"
                  achieved={achievementOverview.achievedActivities}
                  target={achievementOverview.targetActivities}
                  pct={achievementOverview.activityPct}
                />
                <ProgressBar
                  label="Beneficiaries"
                  achieved={achievementOverview.achievedBeneficiaries}
                  target={achievementOverview.targetBeneficiaries}
                  pct={achievementOverview.beneficiaryPct}
                  color="#3b82f6"
                />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
