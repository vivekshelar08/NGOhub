import {
  generateImpactAnalysis,
  resolveAiEngine,
  callAiEngine,
  getAiEngineLabel,
  type ImpactAnalysisJson,
} from "@/lib/ai-engine";

export type ReportType =
  | "beneficiaries"
  | "activities"
  | "meetings"
  | "achievements"
  | "combined"
  | "impact";

export interface ImpactChartData {
  activityStatus: Array<{ name: string; value: number }>;
  beneficiaryCategory: Array<{ name: string; value: number }>;
  activityTrend: Array<{ month: string; count: number }>;
  kpiProgress: {
    activityPct: number | null;
    beneficiaryPct: number | null;
    overallPct: number | null;
    achievedActivities: number;
    targetActivities: number;
    achievedBeneficiaries: number;
    targetBeneficiaries: number;
    activeProjects: number;
  };
}

export interface ImpactReportPayload extends ReportFilterPayload {
  reportType: "impact";
  filterSummary?: string;
  projectTitle?: string;
  analytics?: {
    donationsTotal?: number | null;
    donationCount?: number | null;
    expensesTotal?: number | null;
    volunteerHours?: number | null;
    urgentCases?: number;
    caseStudies?: number;
    beneficiariesEnrolled?: number;
    completedDeliveries?: number;
    activeDeliveries?: number;
    meetingsApproved?: number;
    financePermitted?: boolean;
    communityContributionCollected?: number;
    communityContributionPending?: number;
    communityContributionEntries?: number;
  };
  achievementDetail?: {
    byStatus?: Record<string, number>;
    activityPct?: number | null;
    beneficiaryPct?: number | null;
    overallPct?: number | null;
  };
  sdgBreakdown?: Array<{
    sdgId: number;
    projectCount: number;
    achievedBeneficiaries: number;
    targetBeneficiaries: number;
    overallPct: number | null;
  }>;
  cohortSummary?: {
    taggedBeneficiaries: number;
    topCohorts: Array<{ label: string; count: number }>;
  };
  charts?: ImpactChartData;
}

export interface ImpactReportSections {
  executiveSummary: string;
  inputs: string;
  outputs: string;
  outcomes: string;
  insights: string[];
  impact: string;
  sdgContribution: string;
  lessonsLearned: string;
  programActivities: string;
  beneficiaryImpact: string;
  kpiProgress: string;
  financialHighlights?: string;
  communityContribution?: string;
  recommendations: string;
}

export interface ImpactReportResult {
  narrative: string;
  provider: "groq" | "gemini" | "openai" | "template";
  aiModel?: string;
  generatedAt: string;
  filterSummary: string;
  charts: ImpactChartData;
  sections: ImpactReportSections;
}

export interface ReportFilterPayload {
  reportType: ReportType;
  projectId?: string;
  from?: string;
  to?: string;
  status?: string;
  category?: string;
  urgentOnly?: boolean;
  caseStudyOnly?: boolean;
  workType?: string;
  sdgGoal?: number;
  query?: string;
  /** Client-side activity tasks (from localStorage) */
  activities?: Array<{
    id: string;
    title: string;
    projectTitle: string;
    workType: string;
    status: string;
    scheduledDate?: string;
    completedAt?: string;
    beneficiaryCount?: number;
    notes?: string;
  }>;
  /** Client-side achievement summary */
  achievementSummary?: {
    targetActivities: number;
    achievedActivities: number;
    targetBeneficiaries: number;
    achievedBeneficiaries: number;
    projectCount: number;
  };
}

export interface ReportDataSnapshot {
  reportType: ReportType;
  generatedAt: string;
  filters: Omit<ReportFilterPayload, "activities" | "achievementSummary">;
  stats: Record<string, number | string>;
  highlights: string[];
  rows: Array<Record<string, string | number | null>>;
}

export interface AiReportResult {
  narrative: string;
  provider: "groq" | "gemini" | "openai" | "template";
  aiModel?: string;
  snapshot: ReportDataSnapshot;
}

function pct(achieved: number, target: number): string {
  if (target <= 0) return "N/A";
  return `${Math.min(100, Math.round((achieved / target) * 100))}%`;
}

export function buildTemplateNarrative(snapshot: ReportDataSnapshot): string {
  const { reportType, stats, highlights, filters } = snapshot;
  const dateRange =
    filters.from || filters.to
      ? ` for the period ${filters.from ?? "start"} to ${filters.to ?? "present"}`
      : "";

  const lines: string[] = [];

  switch (reportType) {
    case "beneficiaries":
      lines.push(
        `# Beneficiary Impact Report${dateRange}`,
        "",
        `This report covers **${stats.total ?? 0} beneficiaries** enrolled in the service portal.`,
        `- Urgent cases: ${stats.urgent ?? 0}`,
        `- Case studies flagged: ${stats.caseStudy ?? 0}`,
        `- Active service deliveries: ${stats.activeDeliveries ?? 0}`,
        `- Completed services: ${stats.completedDeliveries ?? 0}`,
        ""
      );
      break;
    case "activities":
      lines.push(
        `# Field Activities Report${dateRange}`,
        "",
        `A total of **${stats.total ?? 0} field activities** were recorded.`,
        `- Completed: ${stats.completed ?? 0}`,
        `- In progress / assigned: ${stats.pending ?? 0}`,
        `- Beneficiaries reached: ${stats.beneficiariesReached ?? 0}`,
        ""
      );
      break;
    case "meetings":
      lines.push(
        `# Meetings & Calendar Report${dateRange}`,
        "",
        `**${stats.total ?? 0} meeting/activity requests** were tracked.`,
        `- Approved: ${stats.approved ?? 0}`,
        `- Pending: ${stats.pending ?? 0}`,
        `- Rejected: ${stats.rejected ?? 0}`,
        ""
      );
      break;
    case "achievements":
      lines.push(
        `# KPI Achievement Report${dateRange}`,
        "",
        `Organization progress across **${stats.projectCount ?? 0} projects**:`,
        `- Activities: ${stats.achievedActivities ?? 0} of ${stats.targetActivities ?? 0} (${pct(Number(stats.achievedActivities), Number(stats.targetActivities))})`,
        `- Beneficiaries: ${stats.achievedBeneficiaries ?? 0} of ${stats.targetBeneficiaries ?? 0} (${pct(Number(stats.achievedBeneficiaries), Number(stats.targetBeneficiaries))})`,
        ""
      );
      break;
    default:
      lines.push(`# Organization Report${dateRange}`, "");
      for (const [key, value] of Object.entries(stats)) {
        lines.push(`- ${key.replace(/([A-Z])/g, " $1").trim()}: ${value}`);
      }
      lines.push("");
  }

  if (highlights.length > 0) {
    lines.push("## Key Highlights", "");
    for (const h of highlights.slice(0, 8)) {
      lines.push(`- ${h}`);
    }
    lines.push("");
  }

  lines.push(
    "## Recommendations",
    "",
    "- Continue monitoring urgent cases and overdue rechecks to maintain service quality.",
    "- Share field activity outcomes with project coordinators for milestone tracking.",
    "- Use filtered Excel exports for donor reporting and audit documentation.",
    "",
    `*Report generated on ${new Date(snapshot.generatedAt).toLocaleString("en-IN")} using built-in analytics.*`
  );

  return lines.join("\n");
}

function buildAiPrompt(snapshot: ReportDataSnapshot): string {
  return `Generate an NGO impact report based on this data:

Report type: ${snapshot.reportType}
Date range: ${snapshot.filters.from ?? "all time"} to ${snapshot.filters.to ?? "present"}
Project filter: ${snapshot.filters.projectId ?? "all projects"}

Statistics:
${JSON.stringify(snapshot.stats, null, 2)}

Highlights:
${snapshot.highlights.map((h) => `- ${h}`).join("\n")}

Sample records (up to 5):
${JSON.stringify(snapshot.rows.slice(0, 5), null, 2)}

Write a professional report with: Executive Summary, Impact Analysis, Key Observations, and Recommendations.`;
}

export async function generateAiNarrative(snapshot: ReportDataSnapshot): Promise<AiReportResult> {
  const prompt = buildAiPrompt(snapshot);
  const config = resolveAiEngine();

  if (config.provider !== "template") {
    const result = await callAiEngine({
      messages: [
        {
          role: "system",
          content:
            "You are an NGO impact reporting assistant. Write clear, professional reports for donors and management. Use markdown headings. Be factual — only use data provided. Include sections: Executive Summary, Outputs & Outcomes, Key Insights, and Recommendations.",
        },
        { role: "user", content: prompt },
      ],
      maxTokens: 2000,
    });
    if (result) {
      return {
        narrative: result.content,
        provider: result.provider,
        aiModel: result.model,
        snapshot,
      };
    }
  }

  return {
    narrative: buildTemplateNarrative(snapshot),
    provider: "template",
    snapshot,
  };
}

function formatDateRange(from?: string, to?: string): string {
  if (from || to) return `${from ?? "start"} to ${to ?? "present"}`;
  return "the reporting period";
}

function buildImpactSections(payload: ImpactReportPayload): ImpactReportSections {
  const activities = payload.activities ?? [];
  const summary = payload.achievementSummary;
  const analytics = payload.analytics;
  const completed = activities.filter((a) => a.status === "completed").length;
  const inProgress = activities.filter((a) => ["assigned", "active"].includes(a.status)).length;
  const beneficiariesReached = activities.reduce(
    (s, a) => s + (a.beneficiaryCount ?? 0),
    0
  );
  const completionRate =
    activities.length > 0 ? Math.round((completed / activities.length) * 100) : 0;
  const dateRange = formatDateRange(payload.from, payload.to);
  const projectLabel = payload.projectTitle ?? (payload.projectId ? "selected project" : "all programs");

  const executiveSummary = [
    `During ${dateRange}, the organization delivered measurable impact across ${projectLabel}. `,
    `Field teams completed ${completed} of ${activities.length} tracked activities (${completionRate}% completion rate), directly reaching ${beneficiariesReached.toLocaleString("en-IN")} beneficiaries through camps, workshops, and outreach.`,
    summary
      ? ` Overall program KPI attainment stands at ${summary.achievedActivities}/${summary.targetActivities} activities and ${summary.achievedBeneficiaries}/${summary.targetBeneficiaries} beneficiaries across ${summary.projectCount} active projects.`
      : "",
  ].join("");

  const inputs = [
    `Program delivery during ${dateRange} mobilized field teams across ${activities.length} planned activities.`,
    analytics?.volunteerHours != null
      ? ` Volunteers contributed ${Math.round(analytics.volunteerHours)} logged hours as a key input extending reach.`
      : "",
    analytics?.financePermitted && analytics.donationsTotal != null
      ? ` Financial inputs included ${formatInr(analytics.donationsTotal)} in donor contributions across ${analytics.donationCount ?? 0} gifts.`
      : "",
    analytics?.meetingsApproved != null
      ? ` ${analytics.meetingsApproved} calendar events were approved to coordinate planning and stakeholder engagement.`
      : "",
  ].join("");

  const outputs = [
    `Direct program outputs include ${completed} completed field activities and ${beneficiariesReached.toLocaleString("en-IN")} beneficiaries reached through on-ground service delivery.`,
    analytics?.beneficiariesEnrolled != null
      ? ` ${analytics.beneficiariesEnrolled.toLocaleString("en-IN")} beneficiaries are enrolled in the service portal for ongoing case management.`
      : "",
    analytics?.completedDeliveries != null
      ? ` ${analytics.completedDeliveries} service deliveries were completed; ${analytics.activeDeliveries ?? 0} remain in active pipeline.`
      : "",
    inProgress > 0 ? ` ${inProgress} activities are currently assigned or in progress.` : "",
  ].join("");

  const outcomes = summary
    ? [
        `Outcome-level progress shows ${summary.achievedBeneficiaries.toLocaleString("en-IN")} of ${summary.targetBeneficiaries.toLocaleString("en-IN")} target beneficiaries reached`,
        ` and ${summary.achievedActivities.toLocaleString("en-IN")} of ${summary.targetActivities.toLocaleString("en-IN")} planned activities delivered.`,
        payload.achievementDetail?.overallPct != null
          ? ` Consolidated milestone attainment is ${payload.achievementDetail.overallPct}%.`
          : "",
        analytics?.urgentCases
          ? ` ${analytics.urgentCases} urgent cases received prioritized attention.`
          : "",
      ].join(" ")
    : `Field teams reached ${beneficiariesReached.toLocaleString("en-IN")} beneficiaries; configure project milestones to track formal outcome indicators.`;

  const insights: string[] = [];
  if (activities.length > 0) {
    insights.push(
      `${completionRate}% of field activities were completed in the reporting period (${completed}/${activities.length}).`
    );
  }
  if (beneficiariesReached > 0) {
    insights.push(
      `Direct outreach reached ${beneficiariesReached.toLocaleString("en-IN")} beneficiaries through field activities.`
    );
  }
  if (summary && summary.targetBeneficiaries > 0) {
    insights.push(
      `Beneficiary KPI attainment is ${pct(summary.achievedBeneficiaries, summary.targetBeneficiaries)} against program targets.`
    );
  }
  if (analytics?.urgentCases) {
    insights.push(`${analytics.urgentCases} beneficiaries are flagged as urgent cases requiring accelerated support.`);
  }
  if (payload.cohortSummary?.topCohorts.length) {
    const top = payload.cohortSummary.topCohorts[0];
    insights.push(
      `Special-group outreach: ${top.label} is the largest tagged cohort with ${top.count} beneficiaries.`
    );
  }
  if (payload.sdgBreakdown?.length) {
    const sdgIds = payload.sdgBreakdown.map((s) => `SDG ${s.sdgId}`).join(", ");
    insights.push(`Program work aligns with ${sdgIds} across ${payload.sdgBreakdown.length} SDG mapping(s).`);
  }
  if (insights.length === 0) {
    insights.push("Broaden date or project filters to surface more data-driven insights.");
  }

  const communityContribution =
    analytics?.communityContributionEntries != null && analytics.communityContributionEntries > 0
      ? [
          `Community contributions (beneficiary-paid amounts toward services, not NGO profit) totalled ${formatInr(analytics.communityContributionCollected ?? 0)} collected`,
          ` with ${formatInr(analytics.communityContributionPending ?? 0)} still pending across ${analytics.communityContributionEntries} registered service entries.`,
          " Amounts are routed per project rules to the NGO or partner SHGs as configured.",
        ].join("")
      : "No community contribution entries were recorded in this period. Configure per-service rates in project setup or Service Portal.";

  const impact = [
    `Sustained community impact depends on converting ${completed} completed activities into lasting beneficiary outcomes.`,
    analytics?.caseStudies
      ? ` ${analytics.caseStudies} documented case studies provide qualitative evidence of life changes.`
      : "",
    ` Continued investment in milestone tracking, service completion, and equitable cohort outreach will strengthen long-term program impact.`,
  ].join("");

  const sdgContribution =
    payload.sdgBreakdown && payload.sdgBreakdown.length > 0
      ? payload.sdgBreakdown
          .map(
            (s) =>
              `SDG ${s.sdgId}: ${s.projectCount} project(s), ${s.achievedBeneficiaries}/${s.targetBeneficiaries} beneficiaries (${s.overallPct != null ? `${s.overallPct}%` : "tracking"})`
          )
          .join(". ") + "."
      : "Link projects to SDG goals in project setup to enable automated SDG contribution reporting.";

  const lessonsLearned = [
    completionRate >= 70
      ? "Strong activity completion rates indicate effective field coordination."
      : completionRate > 0
        ? "Activity completion rates suggest room to improve scheduling and follow-through on assigned tasks."
        : "Limited activity data in this period — review filters and field data entry practices.",
    analytics?.activeDeliveries
      ? ` ${analytics.activeDeliveries} active service deliveries require continued monitoring to convert outputs into completed outcomes.`
      : "",
  ].join("");

  const programActivities = [
    `Program teams executed ${activities.length} field activities during the reporting window.`,
    `Of these, ${completed} were completed and ${inProgress} remain in progress or assigned.`,
    activities.length > 0
      ? ` Representative work included ${activities
          .slice(0, 3)
          .map((a) => `${a.title} (${a.projectTitle})`)
          .join("; ")}.`
      : " No field activities matched the current filters — broaden the date range or project scope to capture more data.",
  ].join(" ");

  const beneficiaryImpact = [
    `Field activities in this period reached ${beneficiariesReached.toLocaleString("en-IN")} beneficiaries through direct service delivery.`,
    analytics?.urgentCases != null
      ? ` Among enrolled beneficiaries in the database, ${analytics.urgentCases} are flagged as urgent cases and ${analytics.caseStudies ?? 0} as case studies for deeper documentation.`
      : "",
    payload.cohortSummary?.taggedBeneficiaries
      ? ` ${payload.cohortSummary.taggedBeneficiaries} beneficiaries carry special-group cohort tags for disaggregated equity reporting.`
      : "",
  ].join("");

  const kpiProgress = summary
    ? [
        `Milestone-based KPI tracking shows ${summary.achievedActivities.toLocaleString("en-IN")} of ${summary.targetActivities.toLocaleString("en-IN")} target activities achieved`,
        ` and ${summary.achievedBeneficiaries.toLocaleString("en-IN")} of ${summary.targetBeneficiaries.toLocaleString("en-IN")} target beneficiaries reached.`,
        payload.achievementDetail?.overallPct != null
          ? ` Consolidated progress is ${payload.achievementDetail.overallPct}% against program targets.`
          : "",
      ].join(" ")
    : "KPI milestones have not been configured for filtered projects. Set up project milestones to enable outcome tracking.";

  let financialHighlights: string | undefined;
  if (analytics?.financePermitted) {
    financialHighlights = [
      analytics.donationsTotal != null
        ? `Donors contributed ${formatInr(analytics.donationsTotal)} across ${analytics.donationCount ?? 0} recorded gifts.`
        : "",
      analytics.expensesTotal != null
        ? ` Approved program expenses totalled ${formatInr(analytics.expensesTotal)}.`
        : "",
      analytics.volunteerHours != null
        ? ` Volunteers contributed ${Math.round(analytics.volunteerHours)} logged hours, extending program reach at minimal cost.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const recommendations = [
    "Prioritize completion of in-progress field activities and document beneficiary outcomes with evidence attachments.",
    "Review urgent cases and overdue service rechecks weekly to maintain quality of care.",
    "Share KPI progress with project coordinators and align milestone timelines with donor reporting cycles.",
    "Use disaggregated cohort and SDG data in funder reports to demonstrate equitable impact.",
    analytics?.financePermitted
      ? "Maintain transparent fund utilization records for board and donor accountability."
      : "Ensure field data is synced so server-side beneficiary records reflect all outreach.",
  ].join(" ");

  return {
    executiveSummary,
    inputs,
    outputs,
    outcomes,
    insights,
    impact,
    sdgContribution,
    lessonsLearned,
    programActivities,
    beneficiaryImpact,
    kpiProgress,
    financialHighlights,
    communityContribution,
    recommendations,
  };
}

function analysisToSections(analysis: ImpactAnalysisJson): ImpactReportSections {
  return {
    executiveSummary: analysis.executiveSummary,
    inputs: analysis.inputs,
    outputs: analysis.outputs,
    outcomes: analysis.outcomes,
    insights: analysis.insights,
    impact: analysis.impact,
    sdgContribution: analysis.sdgContribution,
    lessonsLearned: analysis.lessonsLearned,
    programActivities: analysis.programActivities,
    beneficiaryImpact: analysis.beneficiaryImpact,
    kpiProgress: analysis.kpiProgress,
    financialHighlights: analysis.financialHighlights,
    recommendations: analysis.recommendations,
  };
}

function buildImpactDataContext(payload: ImpactReportPayload, sections: ImpactReportSections): string {
  return JSON.stringify(
    {
      period: formatDateRange(payload.from, payload.to),
      project: payload.projectTitle ?? payload.projectId ?? "all",
      filterSummary: payload.filterSummary,
      activities: payload.activities?.slice(0, 15),
      achievementSummary: payload.achievementSummary,
      achievementDetail: payload.achievementDetail,
      analytics: payload.analytics,
      sdgBreakdown: payload.sdgBreakdown,
      cohortSummary: payload.cohortSummary,
      templateSections: sections,
    },
    null,
    2
  );
}

function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildImpactTemplateNarrative(
  payload: ImpactReportPayload,
  sections: ImpactReportSections
): string {
  const dateRange = formatDateRange(payload.from, payload.to);
  const scope = payload.projectTitle ?? (payload.projectId ? "Filtered project" : "Organization-wide");

  const lines: string[] = [
    "# NGO Impact Report",
    "",
    `*Reporting period: ${dateRange} · Scope: ${scope}*`,
    "",
    "## Executive Summary",
    "",
    sections.executiveSummary,
    "",
    "## Inputs & Resources Deployed",
    "",
    sections.inputs,
    "",
    "## Program Activities",
    "",
    sections.programActivities,
    "",
    "## Outputs & Deliverables",
    "",
    sections.outputs,
    "",
    "## Outcomes & Measurable Change",
    "",
    sections.outcomes,
    "",
    "## Beneficiary Impact",
    "",
    sections.beneficiaryImpact,
    "",
    "## KPI & Milestone Progress",
    "",
    sections.kpiProgress,
    "",
    "## Key Insights",
    "",
    ...sections.insights.map((i) => `- ${i}`),
    "",
    "## Long-term Impact",
    "",
    sections.impact,
    "",
    "## SDG Contribution",
    "",
    sections.sdgContribution,
    "",
    "## Community Contribution",
    "",
    sections.communityContribution ?? "No community contribution data for this period.",
    "",
    "## Lessons Learned",
    "",
    sections.lessonsLearned,
    "",
  ];

  if (sections.financialHighlights) {
    lines.push("## Financial Highlights", "", sections.financialHighlights, "");
  }

  lines.push(
    "## Recommendations",
    "",
    sections.recommendations,
    "",
    "---",
    "",
    `*Report generated on ${new Date().toLocaleString("en-IN")} · Built-in impact template*`
  );

  return lines.join("\n");
}

export { getAiEngineLabel };

export async function generateImpactReport(payload: ImpactReportPayload): Promise<ImpactReportResult> {
  const templateSections = buildImpactSections(payload);
  const charts: ImpactChartData = payload.charts ?? {
    activityStatus: [],
    beneficiaryCategory: [],
    activityTrend: [],
    kpiProgress: {
      activityPct: payload.achievementDetail?.activityPct ?? null,
      beneficiaryPct: payload.achievementDetail?.beneficiaryPct ?? null,
      overallPct: payload.achievementDetail?.overallPct ?? null,
      achievedActivities: payload.achievementSummary?.achievedActivities ?? 0,
      targetActivities: payload.achievementSummary?.targetActivities ?? 0,
      achievedBeneficiaries: payload.achievementSummary?.achievedBeneficiaries ?? 0,
      targetBeneficiaries: payload.achievementSummary?.targetBeneficiaries ?? 0,
      activeProjects: payload.achievementSummary?.projectCount ?? 0,
    },
  };

  const filterSummary = payload.filterSummary ?? "All data";
  const dataContext = buildImpactDataContext(payload, templateSections);
  const config = resolveAiEngine();

  if (config.provider !== "template") {
    const analysisResult = await generateImpactAnalysis(dataContext);
    if (analysisResult) {
      const sections = {
        ...analysisToSections(analysisResult.analysis),
        communityContribution: templateSections.communityContribution,
      };
      return {
        narrative: buildImpactTemplateNarrative(payload, sections),
        provider: analysisResult.provider,
        aiModel: analysisResult.model,
        generatedAt: new Date().toISOString(),
        filterSummary,
        charts,
        sections,
      };
    }
  }

  return {
    narrative: buildImpactTemplateNarrative(payload, templateSections),
    provider: "template",
    generatedAt: new Date().toISOString(),
    filterSummary,
    charts,
    sections: templateSections,
  };
}
