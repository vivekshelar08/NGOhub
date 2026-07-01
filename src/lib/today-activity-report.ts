import {
  ActivityTask,
  getTaskBeneficiaryCount,
  PROJECT_SUB_TYPE_LABELS,
  WORK_TYPE_LABELS,
} from "@/lib/activities";
import {
  buildSingleTaskShareMessage,
  buildTodaysActivityShareMessage,
  getGenderCounts,
  getServiceWiseCounts,
  getUniqueLocations,
  getContributionCounts,
  formatContributionCountsLine,
} from "@/lib/activity-share";
import { callAiEngine, resolveAiEngine, type AiProvider } from "@/lib/ai-engine";
import { formatDateKey, localDateKey } from "@/lib/hr-utils";
import { DEFAULT_ORG_SETTINGS } from "@/lib/orgSettings";
import {
  DailyContributionSummary,
  formatDailyContributionReportText,
} from "@/lib/community-contribution-shared";

export type TodayActivityReportMode = "single" | "daily";

export interface TodayActivityTaskSummary {
  id: string;
  title: string;
  activityCode?: string;
  projectTitle: string;
  milestoneName?: string;
  kpiName?: string;
  workType: string;
  workTypeLabel: string;
  projectSubType?: string;
  projectSubTypeLabel?: string;
  completedAt?: string;
  notes?: string;
  beneficiaryCount: number;
  serviceWise: Array<{ serviceName: string; count: number }>;
  gender: { male: number; female: number; other: number };
  locations: string[];
  beneficiaryHighlights: Array<{
    name: string;
    gender?: string;
    serviceName?: string;
    category?: string;
    isUrgentCase?: boolean;
  }>;
  hasGpsEvidence: boolean;
  photoCount: number;
  contributions: { paid: number; notPaid: number };
}

export interface TodayActivityReportRequest {
  userName: string;
  orgName?: string;
  mode: TodayActivityReportMode;
  tasks: TodayActivityTaskSummary[];
}

export interface TodayActivityReportResult {
  message: string;
  provider: AiProvider;
  aiModel?: string;
  generatedAt: string;
  mode: TodayActivityReportMode;
  /** True when the classic WhatsApp template was used instead of AI. */
  usedClassicFallback?: boolean;
}

/** Original share messages — always works offline, no API or AI required. */
export function buildClassicTodayReportFromTasks(
  tasks: ActivityTask[],
  userName: string,
  mode: TodayActivityReportMode,
  orgName = DEFAULT_ORG_SETTINGS.orgName
): TodayActivityReportResult {
  const message =
    mode === "single" && tasks.length === 1
      ? buildSingleTaskShareMessage(tasks[0], userName, orgName)
      : buildTodaysActivityShareMessage(tasks, userName, orgName);

  return {
    message,
    provider: "template",
    generatedAt: new Date().toISOString(),
    mode,
    usedClassicFallback: true,
  };
}

export function buildClassicTodayReportFromRequest(
  request: TodayActivityReportRequest
): TodayActivityReportResult {
  const orgName = request.orgName ?? DEFAULT_ORG_SETTINGS.orgName;
  return {
    message: buildTemplateFromSummaries(request),
    provider: "template",
    generatedAt: new Date().toISOString(),
    mode: request.mode,
    usedClassicFallback: true,
  };
}

export function serializeTaskForReport(task: ActivityTask): TodayActivityTaskSummary {
  const beneficiaries = task.beneficiaries ?? [];
  return {
    id: task.id,
    title: task.title,
    activityCode: task.activityCode,
    projectTitle: task.projectTitle,
    milestoneName: task.milestoneName,
    kpiName: task.kpiName,
    workType: task.workType,
    workTypeLabel: WORK_TYPE_LABELS[task.workType],
    projectSubType: task.projectSubType,
    projectSubTypeLabel: task.projectSubType
      ? PROJECT_SUB_TYPE_LABELS[task.projectSubType]
      : undefined,
    completedAt: task.completedAt,
    notes: task.notes?.trim() || undefined,
    beneficiaryCount: getTaskBeneficiaryCount(task),
    serviceWise: getServiceWiseCounts(beneficiaries),
    gender: getGenderCounts(beneficiaries),
    locations: getUniqueLocations(beneficiaries),
    beneficiaryHighlights: beneficiaries.slice(0, 12).map((b) => ({
      name: b.name,
      gender: b.gender,
      serviceName: b.serviceName,
      category: b.category,
      isUrgentCase: b.isUrgentCase,
    })),
    hasGpsEvidence: task.evidenceLatitude != null && task.evidenceLongitude != null,
    photoCount: task.photoAttachments?.length ?? 0,
    contributions: getContributionCounts(beneficiaries),
  };
}

export function appendContributionTallyToReport(
  message: string,
  summary: DailyContributionSummary | null
): string {
  if (!summary || summary.totalEntries === 0) return message;
  return `${message}\n\n${formatDailyContributionReportText(summary)}`;
}

export function buildTemplateFromSummaries(request: TodayActivityReportRequest): string {
  const orgName = request.orgName ?? DEFAULT_ORG_SETTINGS.orgName;
  const dateLabel = formatDateKey(localDateKey(new Date()));

  if (request.mode === "single" && request.tasks[0]) {
    const t = request.tasks[0];
    const services = t.serviceWise.map((s) => `${s.serviceName}: ${s.count}`).join(", ");
    const genderLine =
      t.gender.male + t.gender.female + t.gender.other > 0
        ? `\n👥 Boys: ${t.gender.male} · Girls: ${t.gender.female}${t.gender.other ? ` · Other: ${t.gender.other}` : ""}`
        : "";
    const contributionLine = formatContributionCountsLine(t.contributions);
    const place = t.locations[0] ?? (t.hasGpsEvidence ? "GPS verified" : "On field");

    return [
      `📋 *${orgName} — Field update*`,
      ``,
      `👤 ${request.userName}`,
      `📅 ${dateLabel}`,
      ``,
      `✅ *${t.title}*`,
      t.activityCode ? `🔖 ${t.activityCode}` : null,
      `📁 Project: ${t.projectTitle}`,
      t.milestoneName ? `🎯 ${t.milestoneName}${t.kpiName ? ` → ${t.kpiName}` : ""}` : null,
      `🏷 ${t.workTypeLabel}${t.projectSubTypeLabel ? ` (${t.projectSubTypeLabel})` : ""}`,
      t.beneficiaryCount > 0 ? `👨‍👩‍👧 Total beneficiaries: *${t.beneficiaryCount}*` : null,
      services ? `🩺 Service-wise: ${services}` : null,
      genderLine.trim() || null,
      contributionLine,
      `📍 Location: ${place}`,
      t.notes ? `\n📝 ${t.notes}` : null,
      ``,
      `_Shared from Svitech HR field work_`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const totalBeneficiaries = request.tasks.reduce((s, t) => s + t.beneficiaryCount, 0);
  const dayContributions = request.tasks.reduce(
    (acc, t) => ({
      paid: acc.paid + t.contributions.paid,
      notPaid: acc.notPaid + t.contributions.notPaid,
    }),
    { paid: 0, notPaid: 0 }
  );
  const dayContributionLine = formatContributionCountsLine(dayContributions);
  const header = [
    `📋 *${orgName} — Today's field work*`,
    ``,
    `👤 ${request.userName}`,
    `📅 ${dateLabel}`,
    `✅ ${request.tasks.length} activit${request.tasks.length === 1 ? "y" : "ies"} completed`,
    totalBeneficiaries > 0 ? `👨‍👩‍👧 Total beneficiaries reached: *${totalBeneficiaries}*` : null,
    dayContributionLine,
    ``,
  ].filter(Boolean);

  const body = request.tasks.flatMap((task, index) => {
    const services = task.serviceWise.map((s) => `${s.serviceName}: ${s.count}`).join(", ");
    const place = task.locations[0] ?? (task.hasGpsEvidence ? "GPS verified" : "On field");
    const genderBit =
      task.gender.male + task.gender.female + task.gender.other > 0
        ? ` | Boys ${task.gender.male}, Girls ${task.gender.female}`
        : "";
    const contributionBit = formatContributionCountsLine(task.contributions);

    return [
      `*${index + 1}. ${task.title}*`,
      task.projectTitle,
      `${task.workTypeLabel}${task.beneficiaryCount > 0 ? ` · ${task.beneficiaryCount} people${genderBit}` : ""}`,
      services ? `Services: ${services}` : null,
      contributionBit,
      `📍 ${place}`,
      task.notes ? `Note: ${task.notes}` : null,
      ``,
    ].filter(Boolean);
  });

  return [...header, ...body, `_Shared from Svitech HR field work_`].join("\n");
}

function buildAiPrompt(request: TodayActivityReportRequest): string {
  const dateLabel = formatDateKey(localDateKey(new Date()));
  const orgName = request.orgName ?? DEFAULT_ORG_SETTINGS.orgName;
  const isDaily = request.mode === "daily";

  return `Write a personalized field activity report for ${request.userName} at ${orgName}.
Date: ${dateLabel}
Mode: ${isDaily ? "end-of-day digest of all activities completed today" : "single activity just completed"}

Use a warm, professional tone — written in third person about ${request.userName}'s work (or first person from ${request.userName}'s perspective — choose what reads best for WhatsApp).
Include specific numbers from the data (beneficiary counts, services, locations, gender split).
Light WhatsApp-style emojis are OK (📋 ✅ 👥 📍) but keep it readable.
Structure: short greeting → what was accomplished → impact/people reached → location & services → closing line crediting ${orgName}.
${isDaily ? "Cover each activity briefly in a numbered or bulleted flow." : "Focus on the one activity with rich detail."}
Do NOT invent data. Max ${isDaily ? 450 : 280} words.

ACTIVITY DATA (JSON):
${JSON.stringify(request.tasks, null, 2)}`;
}

export async function generateTodayActivityReport(
  request: TodayActivityReportRequest
): Promise<TodayActivityReportResult> {
  const generatedAt = new Date().toISOString();
  const config = resolveAiEngine();

  if (config.provider !== "template" && request.tasks.length > 0) {
    const result = await callAiEngine({
      messages: [
        {
          role: "system",
          content:
            "You write personalized NGO field worker daily reports for WhatsApp sharing. Be factual, human, and encouraging. Never fabricate statistics.",
        },
        { role: "user", content: buildAiPrompt(request) },
      ],
      temperature: 0.45,
      maxTokens: isDailyMode(request) ? 900 : 600,
    });

    if (result?.content) {
      return {
        message: result.content.trim(),
        provider: result.provider,
        aiModel: result.model,
        generatedAt,
        mode: request.mode,
        usedClassicFallback: false,
      };
    }
  }

  return buildClassicTodayReportFromRequest(request);
}

function isDailyMode(request: TodayActivityReportRequest): boolean {
  return request.mode === "daily";
}

export function getTodayReportProviderLabel(
  provider: AiProvider,
  aiModel?: string
): string {
  switch (provider) {
    case "openai":
      return `AI · OpenAI${aiModel ? ` (${aiModel})` : ""}`;
    case "groq":
      return `AI · Groq${aiModel ? ` (${aiModel})` : ""}`;
    case "gemini":
      return `AI · Gemini${aiModel ? ` (${aiModel})` : ""}`;
    default:
      return "Classic share report (works without AI)";
  }
}
