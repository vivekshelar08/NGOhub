export type ReportType =
  | "beneficiaries"
  | "activities"
  | "meetings"
  | "achievements"
  | "combined";

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
