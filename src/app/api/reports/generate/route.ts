import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/beneficiary-utils";
import { hasFeature } from "@/lib/role-features";
import {
  generateAiNarrative,
  ReportDataSnapshot,
  ReportFilterPayload,
  ReportType,
} from "@/lib/aiReport";
import { BENEFICIARY_CATEGORY_LABELS } from "@/lib/service-portal-utils";
import { parseDateOnly } from "@/lib/hr-utils";

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

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "reports.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as ReportFilterPayload;
    const reportType = body.reportType ?? "combined";
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
