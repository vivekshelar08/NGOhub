/** Shared analytics types for the reporting command center. */

export interface ChartPoint {
  name: string;
  value: number;
}

export interface MonthlySeriesPoint {
  month: string;
  [key: string]: string | number;
}

export interface AnalyticsOverview {
  generatedAt: string;
  permissions: {
    finance: boolean;
    volunteers: boolean;
  };
  kpis: {
    beneficiaries: number;
    urgentCases: number;
    caseStudies: number;
    meetings: number;
    donationsTotal: number | null;
    donationCount: number | null;
    volunteerHours: number | null;
    expensesTotal: number | null;
  };
  beneficiariesByCategory: ChartPoint[];
  beneficiariesByMonth: MonthlySeriesPoint[];
  donationsByMonth: MonthlySeriesPoint[];
  expensesByCategory: ChartPoint[];
  volunteerHoursByMonth: MonthlySeriesPoint[];
  meetingsByStatus: ChartPoint[];
  recentMeetings: {
    id: string;
    title: string;
    status: string;
    scheduledDate: string;
    projectId: string | null;
  }[];
}

export interface ActivityTrendPoint {
  month: string;
  assigned: number;
  active: number;
  completed: number;
  rescheduled: number;
  canceled: number;
  total: number;
}

export interface ActivityLiveEvent {
  id: string;
  title: string;
  status: string;
  workType: string;
  scheduledDate?: string;
  completedAt?: string;
  projectTitle: string;
  beneficiaryCount: number;
  timestamp: string;
}

/** Group activities into monthly status stacks for trend charts. */
export function buildActivityTrendSeries(
  activities: { status: string; scheduledDate?: string; completedAt?: string }[],
  months = 6
): ActivityTrendPoint[] {
  const now = new Date();
  const buckets: ActivityTrendPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      month,
      assigned: 0,
      active: 0,
      completed: 0,
      rescheduled: 0,
      canceled: 0,
      total: 0,
    });
  }

  const bucketMap = new Map(buckets.map((b) => [b.month, b]));

  for (const task of activities) {
    const dateKey = (task.completedAt ?? task.scheduledDate)?.slice(0, 7);
    if (!dateKey) continue;
    const bucket = bucketMap.get(dateKey);
    if (!bucket) continue;

    const status = task.status;
    if (status === "assigned") bucket.assigned += 1;
    else if (status === "active") bucket.active += 1;
    else if (status === "completed") bucket.completed += 1;
    else if (status === "rescheduled") bucket.rescheduled += 1;
    else if (status === "canceled") bucket.canceled += 1;
    bucket.total += 1;
  }

  return buckets;
}

/** Recent activity events for the live feed, sorted newest first. */
export function buildActivityLiveFeed(
  activities: {
    id: string;
    title: string;
    status: string;
    workType: string;
    scheduledDate?: string;
    completedAt?: string;
    projectTitle: string;
    beneficiaryCount?: number;
  }[],
  limit = 12
): ActivityLiveEvent[] {
  return [...activities]
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      workType: t.workType,
      scheduledDate: t.scheduledDate,
      completedAt: t.completedAt,
      projectTitle: t.projectTitle,
      beneficiaryCount: t.beneficiaryCount ?? 0,
      timestamp: t.completedAt ?? t.scheduledDate ?? new Date(0).toISOString(),
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

/** Weekly activity counts for the last N weeks. */
export function buildWeeklyActivitySeries(
  activities: { scheduledDate?: string; completedAt?: string; status: string }[],
  weeks = 8
): { week: string; completed: number; scheduled: number }[] {
  const result: { week: string; completed: number; scheduled: number }[] = [];
  const now = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - i * 7 - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const label = weekStart.toISOString().slice(0, 10);

    let completed = 0;
    let scheduled = 0;
    for (const t of activities) {
      const dateStr = t.completedAt?.slice(0, 10) ?? t.scheduledDate?.slice(0, 10);
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (d < weekStart || d > weekEnd) continue;
      if (t.status === "completed") completed += 1;
      else scheduled += 1;
    }
    result.push({ week: label, completed, scheduled });
  }
  return result;
}
