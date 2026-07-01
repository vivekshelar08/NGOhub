import {
  ActivityTask,
  BeneficiaryEntry,
  getTaskBeneficiaryCount,
  getTaskBeneficiaryMode,
  getTasksForUser,
  PROJECT_SUB_TYPE_LABELS,
  WORK_TYPE_LABELS,
} from "@/lib/activities";
import { localDateKey, formatDateKey } from "@/lib/hr-utils";
import { DEFAULT_ORG_SETTINGS } from "@/lib/orgSettings";

export interface ServiceWiseCount {
  serviceName: string;
  count: number;
}

export interface GenderCounts {
  male: number;
  female: number;
  other: number;
}

export function isTodayIso(iso?: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === localDateKey(new Date());
}

export function getServiceWiseCounts(beneficiaries: BeneficiaryEntry[]): ServiceWiseCount[] {
  const map = new Map<string, number>();
  for (const b of beneficiaries) {
    const name = b.serviceName?.trim() || "Not specified";
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([serviceName, count]) => ({ serviceName, count }));
}

export function getGenderCounts(beneficiaries: BeneficiaryEntry[]): GenderCounts {
  const counts: GenderCounts = { male: 0, female: 0, other: 0 };
  for (const b of beneficiaries) {
    const g = (b.gender ?? "").trim().toLowerCase();
    if (!g) continue;
    if (g.startsWith("m") || g === "male" || g === "boy" || g === "boys") counts.male++;
    else if (g.startsWith("f") || g === "female" || g === "girl" || g === "girls") counts.female++;
    else counts.other++;
  }
  return counts;
}

export function getUniqueLocations(beneficiaries: BeneficiaryEntry[]): string[] {
  const locations = beneficiaries
    .map((b) => b.location?.trim() || b.address?.trim())
    .filter(Boolean) as string[];
  return [...new Set(locations)];
}

export interface ContributionCounts {
  paid: number;
  notPaid: number;
}

export function getContributionCounts(beneficiaries: BeneficiaryEntry[]): ContributionCounts {
  const counts: ContributionCounts = { paid: 0, notPaid: 0 };
  for (const b of beneficiaries) {
    if (b.contributionCollectionStatus === "COLLECTED") counts.paid++;
    else if (b.contributionCollectionStatus === "PENDING") counts.notPaid++;
  }
  return counts;
}

export function formatContributionCountsLine(counts: ContributionCounts): string | null {
  const total = counts.paid + counts.notPaid;
  if (total === 0) return null;
  return `💰 Community contribution: Paid ${counts.paid} · Not paid ${counts.notPaid}`;
}

export function getTasksContributionCounts(tasks: ActivityTask[]): ContributionCounts {
  return tasks.reduce<ContributionCounts>(
    (acc, task) => {
      const c = getContributionCounts(task.beneficiaries ?? []);
      return { paid: acc.paid + c.paid, notPaid: acc.notPaid + c.notPaid };
    },
    { paid: 0, notPaid: 0 }
  );
}

export function getTodaysCompletedTasks(userId: string): ActivityTask[] {
  return getTasksForUser(userId)
    .filter((t) => t.status === "completed" && isTodayIso(t.completedAt))
    .sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function locationLine(task: ActivityTask): string {
  const beneficiaries = task.beneficiaries ?? [];
  const places = getUniqueLocations(beneficiaries);
  if (places.length > 0) return places.slice(0, 3).join(", ");
  if (task.evidenceLatitude != null && task.evidenceLongitude != null) {
    return `GPS ${task.evidenceLatitude.toFixed(4)}, ${task.evidenceLongitude.toFixed(4)}`;
  }
  return "On field";
}

function serviceSummary(task: ActivityTask): string {
  const beneficiaries = task.beneficiaries ?? [];
  const counts = getServiceWiseCounts(beneficiaries);
  if (counts.length === 0) return "";
  return counts.map((s) => `${s.serviceName}: ${s.count}`).join(", ");
}

/** Short share text for one completed activity. */
export function buildSingleTaskShareMessage(
  task: ActivityTask,
  userName: string,
  orgName = DEFAULT_ORG_SETTINGS.orgName
): string {
  const mode = getTaskBeneficiaryMode(task);
  const total = getTaskBeneficiaryCount(task);
  const work = WORK_TYPE_LABELS[task.workType];
  const sub = task.projectSubType ? ` (${PROJECT_SUB_TYPE_LABELS[task.projectSubType]})` : "";
  const services = serviceSummary(task);
  const place = locationLine(task);
  const gender = getGenderCounts(task.beneficiaries ?? []);
  const genderLine =
    gender.male + gender.female + gender.other > 0
      ? `\n👥 Boys: ${gender.male} · Girls: ${gender.female}${gender.other ? ` · Other: ${gender.other}` : ""}`
      : "";
  const contributionLine = formatContributionCountsLine(getContributionCounts(task.beneficiaries ?? []));

  const lines = [
    `📋 *${orgName} — Field update*`,
    ``,
    `👤 ${userName}`,
    `📅 ${formatDateKey(localDateKey(new Date()))}${task.completedAt ? ` · ${formatTime(task.completedAt)}` : ""}`,
    ``,
    `✅ *${task.title}*`,
    task.activityCode ? `🔖 ${task.activityCode}` : null,
    `📁 Project: ${task.projectTitle}`,
    task.milestoneName ? `🎯 ${task.milestoneName}${task.kpiName ? ` → ${task.kpiName}` : ""}` : null,
    `🏷 ${work}${sub}`,
    mode !== "none" ? `👨‍👩‍👧 Total beneficiaries: *${total}*` : null,
    services ? `🩺 Service-wise: ${services}` : null,
    genderLine.trim() || null,
    contributionLine,
    `📍 Location: ${place}`,
    task.notes?.trim() ? `\n📝 ${task.notes.trim()}` : null,
    ``,
    `_Shared from Svitech HR field work_`,
  ];

  return lines.filter(Boolean).join("\n");
}

/** Daily digest for all activities completed today by the user. */
export function buildTodaysActivityShareMessage(
  tasks: ActivityTask[],
  userName: string,
  orgName = DEFAULT_ORG_SETTINGS.orgName
): string {
  if (tasks.length === 0) {
    return `📋 *${orgName} — Daily field update*\n\n👤 ${userName}\n📅 ${formatDateKey(localDateKey(new Date()))}\n\nNo field activities completed today yet.`;
  }

  const totalBeneficiaries = tasks.reduce((sum, t) => sum + getTaskBeneficiaryCount(t), 0);
  const dayContributions = getTasksContributionCounts(tasks);
  const dayContributionLine = formatContributionCountsLine(dayContributions);
  const header = [
    `📋 *${orgName} — Today's field work*`,
    ``,
    `👤 ${userName}`,
    `📅 ${formatDateKey(localDateKey(new Date()))}`,
    `✅ ${tasks.length} activit${tasks.length === 1 ? "y" : "ies"} completed`,
    totalBeneficiaries > 0 ? `👨‍👩‍👧 Total beneficiaries reached: *${totalBeneficiaries}*` : null,
    dayContributionLine,
    ``,
  ].filter(Boolean);

  const body = tasks.flatMap((task, index) => {
    const total = getTaskBeneficiaryCount(task);
    const services = serviceSummary(task);
    const place = locationLine(task);
    const gender = getGenderCounts(task.beneficiaries ?? []);
    const genderBit =
      gender.male + gender.female + gender.other > 0
        ? ` | Boys ${gender.male}, Girls ${gender.female}`
        : "";
    const contributionBit = formatContributionCountsLine(getContributionCounts(task.beneficiaries ?? []));

    return [
      `*${index + 1}. ${task.title}*`,
      task.projectTitle,
      `${WORK_TYPE_LABELS[task.workType]}${total > 0 ? ` · ${total} people${genderBit}` : ""}`,
      services ? `Services: ${services}` : null,
      contributionBit,
      `📍 ${place}`,
      task.notes?.trim() ? `Note: ${task.notes.trim()}` : null,
      ``,
    ].filter(Boolean);
  });

  return [...header, ...body, `_Shared from Svitech HR field work_`].join("\n");
}

export function shareViaWhatsApp(message: string): void {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
