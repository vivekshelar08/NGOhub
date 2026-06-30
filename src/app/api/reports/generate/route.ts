import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/beneficiary-utils";
import { hasFeature } from "@/lib/role-features";
import {
  generateAiNarrative,
  generateImpactReport,
  ImpactReportPayload,
  ReportDataSnapshot,
  ReportFilterPayload,
  ReportType,
} from "@/lib/aiReport";
import { BENEFICIARY_CATEGORY_LABELS } from "@/lib/service-portal-utils";
import { parseDateOnly } from "@/lib/hr-utils";
import { TASK_STATUS_LABELS } from "@/lib/activities";
import type { ActivityTaskStatus } from "@/lib/activities";
import { buildPeriodContributionSummary } from "@/lib/community-contribution";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function buildDateFilter(from?: string, to?: string) {
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

async function buildBeneficiarySnapshot(
  filters: ReportFilterPayload
): Promise<ReportDataSnapshot> {
  const where: Record<string, unknown> = {};
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.category) where.category = filters.category;
  if (filters.urgentOnly) where.isUrgentCase = true;
  if (filters.caseStudyOnly) where.isCaseStudy = true;
  const createdAt = buildDateFilter(filters.from, filters.to);
  if (createdAt) where.createdAt = createdAt;

  const beneficiaries = await prisma.beneficiary.findMany({
    where,
    include: {
      deliveries: { select: { status: true, service: { select: { name: true } } } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const deliveryStats = beneficiaries.flatMap((b) => b.deliveries);
  const stats = {
    total: beneficiaries.length,
    urgent: beneficiaries.filter((b) => b.isUrgentCase).length,
    caseStudy: beneficiaries.filter((b) => b.isCaseStudy).length,
    activeDeliveries: deliveryStats.filter((d) =>
      ["DATA_ENTERED", "IN_PROGRESS"].includes(d.status)
    ).length,
    completedDeliveries: deliveryStats.filter((d) => d.status === "COMPLETED").length,
  };

  const highlights = beneficiaries.slice(0, 5).map(
    (b) =>
      `${b.name} (${b.beneficiaryCode}) — ${BENEFICIARY_CATEGORY_LABELS[b.category]}, ${b.deliveries.length} service(s)`
  );

  return {
    reportType: "beneficiaries",
    generatedAt: new Date().toISOString(),
    filters,
    stats,
    highlights,
    rows: beneficiaries.slice(0, 20).map((b) => ({
      code: b.beneficiaryCode,
      name: b.name,
      category: BENEFICIARY_CATEGORY_LABELS[b.category],
      mobile: b.mobile,
      location: b.location,
      income: decimalToNumber(b.monthlyIncome),
      urgent: b.isUrgentCase ? "Yes" : "No",
      services: b.deliveries.length,
    })),
  };
}

async function buildMeetingsSnapshot(
  filters: ReportFilterPayload
): Promise<ReportDataSnapshot> {
  const where: Record<string, unknown> = {};
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = filters.status;
  if (filters.workType) where.workType = filters.workType;
  const scheduledDate = buildDateFilter(filters.from, filters.to);
  if (scheduledDate) where.scheduledDate = scheduledDate;

  const requests = await prisma.activityRequest.findMany({
    where,
    include: {
      requestedBy: { select: { name: true, department: true } },
    },
    orderBy: { scheduledDate: "desc" },
    take: 500,
  });

  const stats = {
    total: requests.length,
    approved: requests.filter((r) => r.status === "APPROVED").length,
    pending: requests.filter((r) => r.status === "PENDING").length,
    rejected: requests.filter((r) => r.status === "REJECTED").length,
  };

  return {
    reportType: "meetings",
    generatedAt: new Date().toISOString(),
    filters,
    stats,
    highlights: requests.slice(0, 5).map(
      (r) => `${r.title} — ${r.status} on ${r.scheduledDate.toISOString().slice(0, 10)}`
    ),
    rows: requests.slice(0, 20).map((r) => ({
      title: r.title,
      status: r.status,
      workType: r.workType,
      date: r.scheduledDate.toISOString().slice(0, 10),
      requestedBy: r.requestedBy.name,
    })),
  };
}

function buildActivitiesSnapshot(filters: ReportFilterPayload): ReportDataSnapshot {
  let activities = filters.activities ?? [];

  if (filters.from) {
    activities = activities.filter(
      (a) => !a.scheduledDate || a.scheduledDate.slice(0, 10) >= filters.from!
    );
  }
  if (filters.to) {
    activities = activities.filter(
      (a) => !a.scheduledDate || a.scheduledDate.slice(0, 10) <= filters.to!
    );
  }
  if (filters.status) {
    activities = activities.filter((a) => a.status === filters.status);
  }
  if (filters.workType) {
    activities = activities.filter((a) => a.workType === filters.workType);
  }
  if (filters.query?.trim()) {
    const q = filters.query.trim().toLowerCase();
    activities = activities.filter(
      (a) =>
        a.title.toLowerCase().includes(q) || a.projectTitle.toLowerCase().includes(q)
    );
  }

  const stats = {
    total: activities.length,
    completed: activities.filter((a) => a.status === "completed").length,
    pending: activities.filter((a) => ["assigned", "active"].includes(a.status)).length,
    beneficiariesReached: activities.reduce(
      (sum, a) => sum + (a.beneficiaryCount ?? 0),
      0
    ),
  };

  return {
    reportType: "activities",
    generatedAt: new Date().toISOString(),
    filters,
    stats,
    highlights: activities.slice(0, 5).map(
      (a) => `${a.title} (${a.projectTitle}) — ${a.status}, ${a.beneficiaryCount ?? 0} beneficiaries`
    ),
    rows: activities.slice(0, 20).map((a) => ({
      title: a.title,
      project: a.projectTitle,
      status: a.status,
      workType: a.workType,
      date: a.scheduledDate?.slice(0, 10) ?? "",
      beneficiaries: a.beneficiaryCount ?? 0,
    })),
  };
}

function buildAchievementsSnapshot(filters: ReportFilterPayload): ReportDataSnapshot {
  const summary = filters.achievementSummary ?? {
    targetActivities: 0,
    achievedActivities: 0,
    targetBeneficiaries: 0,
    achievedBeneficiaries: 0,
    projectCount: 0,
  };

  return {
    reportType: "achievements",
    generatedAt: new Date().toISOString(),
    filters,
    stats: {
      projectCount: summary.projectCount,
      targetActivities: summary.targetActivities,
      achievedActivities: summary.achievedActivities,
      targetBeneficiaries: summary.targetBeneficiaries,
      achievedBeneficiaries: summary.achievedBeneficiaries,
    },
    highlights: [
      `Activities progress: ${summary.achievedActivities}/${summary.targetActivities}`,
      `Beneficiary progress: ${summary.achievedBeneficiaries}/${summary.targetBeneficiaries}`,
    ],
    rows: [],
  };
}

async function buildCombinedSnapshot(
  filters: ReportFilterPayload
): Promise<ReportDataSnapshot> {
  const [ben, meetings] = await Promise.all([
    buildBeneficiarySnapshot({ ...filters, reportType: "beneficiaries" }),
    buildMeetingsSnapshot({ ...filters, reportType: "meetings" }),
  ]);
  const activities = buildActivitiesSnapshot(filters);

  return {
    reportType: "combined",
    generatedAt: new Date().toISOString(),
    filters,
    stats: {
      beneficiaries: ben.stats.total as number,
      fieldActivities: activities.stats.total as number,
      meetings: meetings.stats.total as number,
      beneficiariesReached: activities.stats.beneficiariesReached as number,
      completedActivities: activities.stats.completed as number,
      approvedMeetings: meetings.stats.approved as number,
    },
    highlights: [...ben.highlights.slice(0, 2), ...activities.highlights.slice(0, 2)],
    rows: [...ben.rows.slice(0, 5), ...activities.rows.slice(0, 5)],
  };
}

async function buildSnapshot(
  reportType: ReportType,
  filters: ReportFilterPayload
): Promise<ReportDataSnapshot> {
  switch (reportType) {
    case "beneficiaries":
      return buildBeneficiarySnapshot(filters);
    case "meetings":
      return buildMeetingsSnapshot(filters);
    case "activities":
      return buildActivitiesSnapshot(filters);
    case "achievements":
      return buildAchievementsSnapshot(filters);
    case "combined":
      return buildCombinedSnapshot(filters);
    default:
      return buildCombinedSnapshot(filters);
  }
}

async function fetchFinanceAnalytics(
  role: string,
  filters: { projectId?: string; from?: string; to?: string }
) {
  const canFinance = hasFeature(role as Parameters<typeof hasFeature>[0], "finance.view");
  const beneficiaryWhere: Record<string, unknown> = {};
  if (filters.projectId) beneficiaryWhere.projectId = filters.projectId;
  const createdAt = buildDateFilter(filters.from, filters.to);
  if (createdAt) beneficiaryWhere.createdAt = createdAt;

  const meetingWhere: Record<string, unknown> = {};
  if (filters.projectId) meetingWhere.projectId = filters.projectId;
  const scheduledDate = buildDateFilter(filters.from, filters.to);
  if (scheduledDate) meetingWhere.scheduledDate = scheduledDate;

  const [beneficiaryCount, deliveries, meetingsApproved] = await Promise.all([
    prisma.beneficiary.count({ where: beneficiaryWhere }),
    prisma.serviceDelivery.findMany({
      where: {
        ...(filters.projectId ? { beneficiary: { projectId: filters.projectId } } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      select: { status: true },
    }),
    prisma.activityRequest.count({
      where: { ...meetingWhere, status: "APPROVED" },
    }),
  ]);

  const completedDeliveries = deliveries.filter((d) => d.status === "COMPLETED").length;
  const activeDeliveries = deliveries.filter((d) =>
    ["DATA_ENTERED", "IN_PROGRESS"].includes(d.status)
  ).length;

  if (!canFinance) {
    return {
      financePermitted: false as const,
      beneficiariesEnrolled: beneficiaryCount,
      completedDeliveries,
      activeDeliveries,
      meetingsApproved,
    };
  }

  const dateFilter = buildDateFilter(filters.from, filters.to);
  const [donations, expenses] = await Promise.all([
    prisma.donation.findMany({
      where: {
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(dateFilter ? { donationDate: dateFilter } : {}),
      },
      select: { amount: true },
    }),
    prisma.expense.findMany({
      where: {
        status: "APPROVED",
        ...(dateFilter ? { expenseDate: dateFilter } : {}),
      },
      select: { amount: true },
    }),
  ]);

  let volunteerHours: number | null = null;
  if (hasFeature(role as Parameters<typeof hasFeature>[0], "activities.list")) {
    const hours = await prisma.volunteerHour.findMany({
      where: dateFilter ? { activityDate: dateFilter } : {},
      select: { hours: true },
    });
    volunteerHours = hours.reduce((s, h) => s + Number(h.hours), 0);
  }

  return {
    financePermitted: true as const,
    donationsTotal: donations.reduce((s, d) => s + Number(d.amount), 0),
    donationCount: donations.length,
    expensesTotal: expenses.reduce((s, e) => s + Number(e.amount), 0),
    volunteerHours,
    beneficiariesEnrolled: beneficiaryCount,
    completedDeliveries,
    activeDeliveries,
    meetingsApproved,
  };
}

async function buildImpactChartsPayload(
  filters: ImpactReportPayload
): Promise<ImpactReportPayload["charts"]> {
  const activities = filters.activities ?? [];
  const statusMap = new Map<string, number>();
  for (const a of activities) {
    const label = TASK_STATUS_LABELS[a.status as ActivityTaskStatus] ?? a.status;
    statusMap.set(label, (statusMap.get(label) ?? 0) + 1);
  }

  const monthMap = new Map<string, number>();
  for (const a of activities) {
    const month = (a.completedAt ?? a.scheduledDate)?.slice(0, 7);
    if (!month) continue;
    monthMap.set(month, (monthMap.get(month) ?? 0) + 1);
  }

  const beneficiaryWhere: Record<string, unknown> = {};
  if (filters.projectId) beneficiaryWhere.projectId = filters.projectId;
  const createdAt = buildDateFilter(filters.from, filters.to);
  if (createdAt) beneficiaryWhere.createdAt = createdAt;

  const beneficiaries = await prisma.beneficiary.findMany({
    where: beneficiaryWhere,
    select: { category: true },
    take: 500,
  });

  const categoryMap = new Map<string, number>();
  for (const b of beneficiaries) {
    const label = BENEFICIARY_CATEGORY_LABELS[b.category] ?? b.category;
    categoryMap.set(label, (categoryMap.get(label) ?? 0) + 1);
  }

  const summary = filters.achievementSummary;

  return {
    activityStatus: Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })),
    beneficiaryCategory: Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value })),
    activityTrend: Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, count]) => ({ month, count })),
    kpiProgress: {
      activityPct: filters.achievementDetail?.activityPct ?? null,
      beneficiaryPct: filters.achievementDetail?.beneficiaryPct ?? null,
      overallPct: filters.achievementDetail?.overallPct ?? null,
      achievedActivities: summary?.achievedActivities ?? 0,
      targetActivities: summary?.targetActivities ?? 0,
      achievedBeneficiaries: summary?.achievedBeneficiaries ?? 0,
      targetBeneficiaries: summary?.targetBeneficiaries ?? 0,
      activeProjects: summary?.projectCount ?? 0,
    },
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "reports.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as ReportFilterPayload & ImpactReportPayload;
    const reportType = body.reportType ?? "combined";

    if (reportType === "impact") {
      const finance = await fetchFinanceAnalytics(user.role, {
        projectId: body.projectId,
        from: body.from,
        to: body.to,
      });

      const beneficiaryWhere: Record<string, unknown> = {};
      if (body.projectId) beneficiaryWhere.projectId = body.projectId;
      const createdAt = buildDateFilter(body.from, body.to);
      if (createdAt) beneficiaryWhere.createdAt = createdAt;

      const beneficiaryCounts = await prisma.beneficiary.groupBy({
        by: ["isUrgentCase", "isCaseStudy"],
        where: beneficiaryWhere,
        _count: true,
      });

      let urgentCases = 0;
      let caseStudies = 0;
      for (const row of beneficiaryCounts) {
        if (row.isUrgentCase) urgentCases += row._count;
        if (row.isCaseStudy) caseStudies += row._count;
      }

      const charts = await buildImpactChartsPayload({ ...body, reportType: "impact" });

      const contributionSummary = await buildPeriodContributionSummary({
        projectId: body.projectId,
        from: body.from ? parseDateOnly(body.from) : undefined,
        to: body.to
          ? (() => {
              const end = parseDateOnly(body.to!);
              end.setHours(23, 59, 59, 999);
              return end;
            })()
          : undefined,
      });

      const impactPayload: ImpactReportPayload = {
        ...body,
        reportType: "impact",
        analytics: {
          ...finance,
          urgentCases,
          caseStudies,
          communityContributionCollected: contributionSummary.collectedAmount,
          communityContributionPending: contributionSummary.pendingAmount,
          communityContributionEntries: contributionSummary.totalEntries,
        },
        charts,
      };

      const result = await generateImpactReport(impactPayload);
      return NextResponse.json(result);
    }

    const snapshot = await buildSnapshot(reportType, { ...body, reportType });
    const result = await generateAiNarrative(snapshot);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /api/reports/generate]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Report generation failed" },
      { status: 500 }
    );
  }
}

/** Export-ready data for Excel from server */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "reports.export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const reportType = (searchParams.get("type") ?? "beneficiaries") as ReportType;

  const filters: ReportFilterPayload = {
    reportType,
    projectId: searchParams.get("projectId") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    urgentOnly: searchParams.get("urgentOnly") === "1",
    caseStudyOnly: searchParams.get("caseStudyOnly") === "1",
    workType: searchParams.get("workType") ?? undefined,
  };

  try {
    const snapshot = await buildSnapshot(reportType, filters);
    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error("[GET /api/reports/data]", error);
    return NextResponse.json({ error: "Failed to load report data" }, { status: 500 });
  }
}
