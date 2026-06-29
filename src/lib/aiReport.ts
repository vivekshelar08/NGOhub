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
    financePermitted?: boolean;
  };
  achievementDetail?: {
    byStatus?: Record<string, number>;
    activityPct?: number | null;
    beneficiaryPct?: number | null;
    overallPct?: number | null;
  };
  charts?: ImpactChartData;
}

export interface ImpactReportResult {
  narrative: string;
  provider: "groq" | "gemini" | "template";
  generatedAt: string;
  filterSummary: string;
  charts: ImpactChartData;
  sections: {
    executiveSummary: string;
    programActivities: string;
    beneficiaryImpact: string;
    kpiProgress: string;
    financialHighlights?: string;
    recommendations: string;
  };
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
  provider: "groq" | "gemini" | "template";
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

async function callGroq(prompt: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are an NGO impact reporting assistant. Write clear, professional reports for donors and management. Use markdown headings. Be factual — only use data provided. Keep reports under 600 words.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
      }),
    }
  );

  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
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

  if (process.env.GROQ_API_KEY) {
    const narrative = await callGroq(prompt);
    if (narrative) {
      return { narrative, provider: "groq", snapshot };
    }
  }

  if (process.env.GEMINI_API_KEY) {
    const narrative = await callGemini(prompt);
    if (narrative) {
      return { narrative, provider: "gemini", snapshot };
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

function buildImpactSections(payload: ImpactReportPayload): ImpactReportResult["sections"] {
  const activities = payload.activities ?? [];
  const summary = payload.achievementSummary;
  const analytics = payload.analytics;
  const completed = activities.filter((a) => a.status === "completed").length;
  const beneficiariesReached = activities.reduce(
    (s, a) => s + (a.beneficiaryCount ?? 0),
    0
  );
  const dateRange = formatDateRange(payload.from, payload.to);
  const projectLabel = payload.projectTitle ?? (payload.projectId ? "selected project" : "all programs");

  const executiveSummary = [
    `During ${dateRange}, the organization delivered measurable impact across ${projectLabel}. `,
    `Field teams completed ${completed} of ${activities.length} tracked activities, directly reaching ${beneficiariesReached.toLocaleString("en-IN")} beneficiaries through camps, workshops, and outreach.`,
    summary
      ? ` Overall program KPI attainment stands at ${summary.achievedActivities}/${summary.targetActivities} activities and ${summary.achievedBeneficiaries}/${summary.targetBeneficiaries} beneficiaries across ${summary.projectCount} active projects.`
      : "",
  ].join("");

  const programActivities = [
    `Program teams executed ${activities.length} field activities during the reporting window.`,
    `Of these, ${completed} were completed and ${activities.filter((a) => ["assigned", "active"].includes(a.status)).length} remain in progress or assigned.`,
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
    ` Continued emphasis on disaggregated reporting by category and special cohort groups ensures equitable outreach and funder accountability.`,
  ].join("");

  const kpiProgress = summary
    ? [
        `Milestone-based KPI tracking shows ${summary.achievedActivities.toLocaleString("en-IN")} of ${summary.targetActivities.toLocaleString("en-IN")} target activities achieved`,
        ` and ${summary.achievedBeneficiaries.toLocaleString("en-IN")} of ${summary.targetBeneficiaries.toLocaleString("en-IN")} target beneficiaries reached.`,
        payload.achievementDetail?.overallPct != null
          ? ` Consolidated progress is ${payload.achievementDetail.overallPct}% against program targets.`
          : "",
        ` Program managers should review at-risk milestones and accelerate completion where gaps persist.`,
      ].join(" ")
    : "KPI milestones have not been configured for filtered projects. Set up project milestones to enable outcome tracking.";

  let financialHighlights: string | undefined;
  if (analytics?.financePermitted) {
    financialHighlights = [
      analytics.donationsTotal != null
        ? `Donors contributed ${formatInr(analytics.donationsTotal)} across ${analytics.donationCount ?? 0} recorded gifts.`
        : "Donation data is available for the filtered period.",
      analytics.expensesTotal != null
        ? ` Approved program expenses totalled ${formatInr(analytics.expensesTotal)}.`
        : "",
      analytics.volunteerHours != null
        ? ` Volunteers contributed ${Math.round(analytics.volunteerHours)} logged hours, extending program reach at minimal cost.`
        : "",
    ].join(" ");
  }

  const recommendations = [
    "Prioritize completion of in-progress field activities and document beneficiary outcomes with evidence attachments.",
    "Review urgent cases and overdue service rechecks weekly to maintain quality of care.",
    "Share KPI progress with project coordinators and align milestone timelines with donor reporting cycles.",
    analytics?.financePermitted
      ? "Maintain transparent fund utilization records for board and donor accountability."
      : "Ensure field data is synced so server-side beneficiary records reflect all outreach.",
  ].join(" ");

  return {
    executiveSummary,
    programActivities,
    beneficiaryImpact,
    kpiProgress,
    financialHighlights,
    recommendations,
  };
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
  sections: ImpactReportResult["sections"]
): string {
  const dateRange = formatDateRange(payload.from, payload.to);
  const projectLine = payload.projectTitle
    ? `**Project:** ${payload.projectTitle}`
    : payload.projectId
      ? "**Project filter applied**"
      : "**Scope:** Organization-wide";

  const lines: string[] = [
    "# NGO Impact Report",
    "",
    `*Reporting period: ${dateRange} · ${projectLine.replace(/\*\*/g, "")}*`,
    "",
    "## Executive Summary",
    "",
    sections.executiveSummary,
    "",
    "## Program Activities",
    "",
    sections.programActivities,
    "",
    "## Beneficiary Impact",
    "",
    sections.beneficiaryImpact,
    "",
    "## KPI & Milestone Progress",
    "",
    sections.kpiProgress,
    "",
  ];

  if (sections.financialHighlights) {
    lines.push("## Financial Highlights", "", sections.financialHighlights, "");
  }

  lines.push(
    "## Recommendations",
    "",
    ...sections.recommendations.split(". ").filter(Boolean).map((r) => `- ${r.trim().replace(/\.$/, "")}.`),
    "",
    "---",
    "",
    `*Report generated on ${new Date().toLocaleString("en-IN")} · Built-in impact template*`
  );

  return lines.join("\n");
}

function buildImpactAiPrompt(
  payload: ImpactReportPayload,
  sections: ImpactReportResult["sections"]
): string {
  return `You are writing a donor- and board-ready NGO impact report. Use ONLY the facts below. Write rich, multi-paragraph prose (not bullet lists) for each section. Use markdown with ## headings.

Reporting period: ${formatDateRange(payload.from, payload.to)}
Project: ${payload.projectTitle ?? payload.projectId ?? "all programs"}
Filter: ${payload.filterSummary ?? "none"}

Draft section content (expand and polish — add connective narrative, keep all numbers accurate):
- Executive Summary: ${sections.executiveSummary}
- Program Activities: ${sections.programActivities}
- Beneficiary Impact: ${sections.beneficiaryImpact}
- KPI Progress: ${sections.kpiProgress}
${sections.financialHighlights ? `- Financial Highlights: ${sections.financialHighlights}` : ""}
- Recommendations: ${sections.recommendations}

Activity stats: ${JSON.stringify(payload.activities?.slice(0, 10) ?? [])}
Achievement summary: ${JSON.stringify(payload.achievementSummary ?? {})}
Analytics: ${JSON.stringify(payload.analytics ?? {})}

Write sections: Executive Summary, Program Activities, Beneficiary Impact, KPI & Milestone Progress${sections.financialHighlights ? ", Financial Highlights" : ""}, and Recommendations. Each section should be 2-4 paragraphs. Professional tone for Indian NGO context. Under 900 words total.`;
}

async function callGroqImpact(prompt: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are an expert NGO impact reporting writer for Indian nonprofits. Write polished, factual donor-ready reports in markdown. Never invent statistics.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.35,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

async function callGeminiImpact(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 2000 },
      }),
    }
  );

  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
}

export async function generateImpactReport(payload: ImpactReportPayload): Promise<ImpactReportResult> {
  const sections = buildImpactSections(payload);
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
  const prompt = buildImpactAiPrompt(payload, sections);

  if (process.env.GROQ_API_KEY) {
    const narrative = await callGroqImpact(prompt);
    if (narrative) {
      return {
        narrative,
        provider: "groq",
        generatedAt: new Date().toISOString(),
        filterSummary,
        charts,
        sections,
      };
    }
  }

  if (process.env.GEMINI_API_KEY) {
    const narrative = await callGeminiImpact(prompt);
    if (narrative) {
      return {
        narrative,
        provider: "gemini",
        generatedAt: new Date().toISOString(),
        filterSummary,
        charts,
        sections,
      };
    }
  }

  return {
    narrative: buildImpactTemplateNarrative(payload, sections),
    provider: "template",
    generatedAt: new Date().toISOString(),
    filterSummary,
    charts,
    sections,
  };
}
