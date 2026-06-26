import { loadActivityTasks, TASK_STATUS_LABELS, WORK_TYPE_LABELS, getTaskBeneficiaryCount } from "@/lib/activities";
import { BeneficiaryExportRow } from "@/lib/beneficiaryExport";
import { exportSheetsToExcel, safeExportFilename } from "@/lib/excelUtils";
import { MeetingExportRow } from "@/lib/meetingExport";
import { loadProjects } from "@/lib/projects";
import { BENEFICIARY_CATEGORY_LABELS, BENEFICIARY_COHORT_LABELS } from "@/lib/service-portal-utils";
import { BeneficiaryCategory, BeneficiaryCohort } from "@/generated/prisma/enums";
import { recordBackupDate } from "@/lib/backup-reminder";

function cohortLabels(cohorts?: BeneficiaryCohort[]): string {
  if (!cohorts?.length) return "";
  return cohorts.map((c) => BENEFICIARY_COHORT_LABELS[c]).join(", ");
}

async function fetchAllBeneficiaries(): Promise<BeneficiaryExportRow[]> {
  const res = await fetch("/api/beneficiaries?export=1&includeDeliveries=1");
  if (!res.ok) return [];
  const data = await res.json();
  return (data.beneficiaries as BeneficiaryExportRow[]) ?? [];
}

async function fetchAllMeetings(): Promise<MeetingExportRow[]> {
  const res = await fetch("/api/calendar/requests?all=1");
  if (!res.ok) return [];
  const data = await res.json();
  return (data.requests as MeetingExportRow[]) ?? [];
}

/** Full organization backup — beneficiaries, activities, projects, calendar requests. */
export async function exportFullOrgBackup(): Promise<void> {
  const [beneficiaries, meetings] = await Promise.all([
    fetchAllBeneficiaries(),
    fetchAllMeetings(),
  ]);
  const activities = loadActivityTasks();
  const projects = loadProjects();

  const sheets = [
    {
      name: "Beneficiaries",
      headers: [
        "Code",
        "Name",
        "Category",
        "Cohorts",
        "Mobile",
        "Location",
        "Urgent",
        "Case Study",
        "Project",
        "Services",
      ],
      rows: beneficiaries.map((b) => [
        b.beneficiaryCode,
        b.name,
        BENEFICIARY_CATEGORY_LABELS[b.category as BeneficiaryCategory] ?? b.category,
        cohortLabels(b.cohorts as BeneficiaryCohort[] | undefined),
        b.mobile ?? "",
        b.location ?? "",
        b.isUrgentCase ? "Yes" : "No",
        b.isCaseStudy ? "Yes" : "No",
        b.projectId ?? "",
        b.deliveries?.length ?? 0,
      ]),
    },
    {
      name: "Field Activities",
      headers: [
        "Code",
        "Title",
        "Project",
        "Status",
        "Work Type",
        "Scheduled",
        "Completed",
        "Beneficiaries",
      ],
      rows: activities.map((t) => [
        t.activityCode ?? "",
        t.title,
        t.projectTitle,
        TASK_STATUS_LABELS[t.status],
        WORK_TYPE_LABELS[t.workType],
        t.scheduledDate?.slice(0, 10) ?? "",
        t.completedAt?.slice(0, 10) ?? "",
        getTaskBeneficiaryCount(t),
      ]),
    },
    {
      name: "Projects",
      headers: ["ID", "Title", "Status", "Type", "Beneficiary Count Mode", "Target Beneficiaries"],
      rows: projects.map((p) => [
        p.id,
        p.title,
        p.status,
        p.projectType,
        p.beneficiaryCountMode ?? "unique",
        p.totalBeneficiaries,
      ]),
    },
    {
      name: "Calendar Requests",
      headers: ["Title", "Status", "Date", "End", "Work Type", "Requested By"],
      rows: meetings.map((m) => [
        m.title,
        m.status ?? "",
        m.scheduledDate?.slice(0, 10) ?? "",
        m.endDate?.slice(0, 10) ?? "",
        m.workType ?? "",
        m.requestedByName ?? "",
      ]),
    },
    {
      name: "Backup Info",
      headers: ["Field", "Value"],
      rows: [
        ["Generated at", new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })],
        ["Timezone", "Asia/Kolkata (IST, UTC+5:30)"],
        ["Beneficiary records", beneficiaries.length],
        ["Field activities", activities.length],
        ["Projects", projects.length],
        ["Calendar requests", meetings.length],
      ],
    },
  ];

  exportSheetsToExcel(sheets, safeExportFilename("ngo-full-backup", "all-data"));
  recordBackupDate();
}
