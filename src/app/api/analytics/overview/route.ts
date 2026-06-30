import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/hr-utils";
import { BENEFICIARY_CATEGORY_LABELS } from "@/lib/service-portal-utils";
import type { AnalyticsOverview, ChartPoint, MonthlySeriesPoint } from "@/lib/analytics";
import { buildPeriodContributionSummary } from "@/lib/community-contribution";

function buildDateFilter(from?: string | null, to?: string | null) {
  if (!from && !to) return undefined;
  const filter: { gte?: Date; lte?: Date } = {};
  if (from) filter.gte = parseDateOnly(from);
  if (to) {
    const end = parseDateOnly(to);
    end.setHours(23, 59, 59, 999);
    filter.lte = end;
  }
  return filter;
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function lastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }
  return months;
}

function groupByMonth<T>(
  items: T[],
  getDate: (item: T) => Date | null,
  months: string[]
): MonthlySeriesPoint[] {
  const map = new Map(months.map((m) => [m, 0]));
  for (const item of items) {
    const d = getDate(item);
    if (!d) continue;
    const key = monthKey(d);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return months.map((month) => ({ month, count: map.get(month) ?? 0 }));
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "reports.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  const canFinance = hasFeature(user.role, "finance.view");
  const canVolunteers = hasFeature(user.role, "activities.list");

  const beneficiaryWhere: Record<string, unknown> = {};
  if (projectId) beneficiaryWhere.projectId = projectId;
  const createdAt = buildDateFilter(from, to);
  if (createdAt) beneficiaryWhere.createdAt = createdAt;

  const meetingWhere: Record<string, unknown> = {};
  if (projectId) meetingWhere.projectId = projectId;
  const scheduledDate = buildDateFilter(from, to);
  if (scheduledDate) meetingWhere.scheduledDate = scheduledDate;

  const months = lastNMonths(6);

  const [
    beneficiaries,
    meetings,
    donations,
    expenses,
    volunteerHours,
    contributionSummary,
  ] = await Promise.all([
    prisma.beneficiary.findMany({
      where: beneficiaryWhere,
      select: {
        id: true,
        category: true,
        isUrgentCase: true,
        isCaseStudy: true,
        createdAt: true,
      },
    }),
    prisma.activityRequest.findMany({
      where: meetingWhere,
      select: {
        id: true,
        title: true,
        status: true,
        scheduledDate: true,
        projectId: true,
      },
      orderBy: { scheduledDate: "desc" },
      take: 200,
    }),
    canFinance
      ? prisma.donation.findMany({
          where: {
            ...(projectId ? { projectId } : {}),
            ...(buildDateFilter(from, to)
              ? { donationDate: buildDateFilter(from, to) }
              : {}),
          },
          select: { amount: true, donationDate: true },
        })
      : Promise.resolve([]),
    canFinance
      ? prisma.expense.findMany({
          where: {
            status: "APPROVED",
            ...(buildDateFilter(from, to)
              ? { expenseDate: buildDateFilter(from, to) }
              : {}),
          },
          select: { amount: true, category: true, expenseDate: true },
        })
      : Promise.resolve([]),
    canVolunteers
      ? prisma.volunteerHour.findMany({
          where: buildDateFilter(from, to)
            ? { activityDate: buildDateFilter(from, to) }
            : {},
          select: { hours: true, activityDate: true },
        })
      : Promise.resolve([]),
    buildPeriodContributionSummary({
      projectId,
      from: from ? parseDateOnly(from) : undefined,
      to: to
        ? (() => {
            const end = parseDateOnly(to);
            end.setHours(23, 59, 59, 999);
            return end;
          })()
        : undefined,
    }),
  ]);

  const categoryMap = new Map<string, number>();
  for (const b of beneficiaries) {
    const label = BENEFICIARY_CATEGORY_LABELS[b.category] ?? b.category;
    categoryMap.set(label, (categoryMap.get(label) ?? 0) + 1);
  }
  const beneficiariesByCategory: ChartPoint[] = Array.from(categoryMap.entries()).map(
    ([name, value]) => ({ name, value })
  );

  const beneficiariesByMonth = groupByMonth(
    beneficiaries,
    (b) => b.createdAt,
    months
  );

  const meetingStatusMap = new Map<string, number>();
  for (const m of meetings) {
    meetingStatusMap.set(m.status, (meetingStatusMap.get(m.status) ?? 0) + 1);
  }
  const meetingsByStatus: ChartPoint[] = Array.from(meetingStatusMap.entries()).map(
    ([name, value]) => ({ name, value })
  );

  let donationsByMonth: MonthlySeriesPoint[] = [];
  let donationsTotal: number | null = null;
  if (canFinance) {
    const donationMonthMap = new Map(months.map((m) => [m, 0]));
    donationsTotal = 0;
    for (const d of donations) {
      const amt = Number(d.amount);
      donationsTotal += amt;
      const key = monthKey(d.donationDate);
      if (donationMonthMap.has(key)) {
        donationMonthMap.set(key, (donationMonthMap.get(key) ?? 0) + amt);
      }
    }
    donationsByMonth = months.map((month) => ({
      month,
      amount: donationMonthMap.get(month) ?? 0,
    }));
  }

  let expensesByCategory: ChartPoint[] = [];
  let expensesTotal: number | null = null;
  if (canFinance) {
    const expenseMap = new Map<string, number>();
    expensesTotal = 0;
    for (const e of expenses) {
      const amt = Number(e.amount);
      expensesTotal += amt;
      expenseMap.set(e.category, (expenseMap.get(e.category) ?? 0) + amt);
    }
    expensesByCategory = Array.from(expenseMap.entries()).map(([name, value]) => ({
      name,
      value: Math.round(value),
    }));
  }

  let volunteerHoursByMonth: MonthlySeriesPoint[] = [];
  let volunteerHoursTotal: number | null = null;
  if (canVolunteers) {
    const hoursMap = new Map(months.map((m) => [m, 0]));
    volunteerHoursTotal = 0;
    for (const h of volunteerHours) {
      const hrs = Number(h.hours);
      volunteerHoursTotal += hrs;
      const key = monthKey(h.activityDate);
      if (hoursMap.has(key)) {
        hoursMap.set(key, (hoursMap.get(key) ?? 0) + hrs);
      }
    }
    volunteerHoursByMonth = months.map((month) => ({
      month,
      hours: Math.round((hoursMap.get(month) ?? 0) * 10) / 10,
    }));
  }

  const overview: AnalyticsOverview = {
    generatedAt: new Date().toISOString(),
    permissions: { finance: canFinance, volunteers: canVolunteers },
    kpis: {
      beneficiaries: beneficiaries.length,
      urgentCases: beneficiaries.filter((b) => b.isUrgentCase).length,
      caseStudies: beneficiaries.filter((b) => b.isCaseStudy).length,
      meetings: meetings.length,
      donationsTotal,
      donationCount: canFinance ? donations.length : null,
      volunteerHours: volunteerHoursTotal,
      expensesTotal,
      communityContributionCollected: contributionSummary.collectedAmount,
      communityContributionPending: contributionSummary.pendingAmount,
      communityContributionEntries: contributionSummary.totalEntries,
    },
    beneficiariesByCategory,
    beneficiariesByMonth,
    donationsByMonth,
    expensesByCategory,
    volunteerHoursByMonth,
    meetingsByStatus,
    communityContributionsByMonth: contributionSummary.byMonth.map((m) => ({
      month: m.month,
      collected: m.collected,
      pending: m.pending,
    })),
    communityContributionsByService: contributionSummary.byService.map((s) => ({
      name: s.serviceName,
      value: Math.round(s.collectedAmount + s.pendingAmount),
    })),
    recentMeetings: meetings.slice(0, 8).map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      scheduledDate: m.scheduledDate.toISOString().slice(0, 10),
      projectId: m.projectId,
    })),
  };

  return NextResponse.json(overview);
}
