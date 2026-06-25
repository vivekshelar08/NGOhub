import {
  ActivityTask,
  BENEFICIARY_MODE_LABELS,
  getTaskBeneficiaryCount,
  getTaskBeneficiaryMode,
  PROJECT_SUB_TYPE_LABELS,
  TASK_STATUS_LABELS,
  WORK_TYPE_LABELS,
} from "@/lib/activities";
import { exportSheetsToExcel, safeExportFilename } from "@/lib/excelUtils";
import { BENEFICIARY_CATEGORY_LABELS } from "@/lib/service-portal-utils";
import { BeneficiaryCategory } from "@/generated/prisma/enums";

function taskSummaryRow(task: ActivityTask): (string | number | null)[] {
  const mode = getTaskBeneficiaryMode(task);
  return [
    task.activityCode ?? "",
    task.title,
    task.projectTitle,
    task.milestoneName ?? "",
    task.kpiName ?? "",
    WORK_TYPE_LABELS[task.workType],
    task.projectSubType ? PROJECT_SUB_TYPE_LABELS[task.projectSubType] : "",
    task.source === "milestone_kpi" ? "Milestone KPI" : "Additional",
    TASK_STATUS_LABELS[task.status],
    task.scheduledDate ? new Date(task.scheduledDate).toLocaleDateString("en-IN") : "",
    task.startedAt ? new Date(task.startedAt).toLocaleDateString("en-IN") : "",
    task.completedAt ? new Date(task.completedAt).toLocaleDateString("en-IN") : "",
    BENEFICIARY_MODE_LABELS[mode],
    getTaskBeneficiaryCount(task),
    task.notes ?? "",
    (task.photoAttachments?.length ?? 0) + (task.pdfAttachments?.length ?? 0),
  ];
}

const TASK_HEADERS = [
  "Activity Code",
  "Title",
  "Project",
  "Milestone",
  "KPI",
  "Work Type",
  "Sub Type",
  "Source",
  "Status",
  "Scheduled",
  "Started",
  "Completed",
  "Beneficiary Mode",
  "Beneficiaries",
  "Notes",
  "Attachments",
];

const BENEFICIARY_HEADERS = [
  "Name",
  "Contact",
  "Age",
  "Gender",
  "Category",
  "Location",
  "Address",
  "Annual Income",
  "Family Members",
  "Service",
  "Urgent",
  "Case Study",
  "Code",
  "Notes",
];

function beneficiaryRows(task: ActivityTask): (string | number | null)[][] {
  return (task.beneficiaries ?? []).map((b) => [
    b.name,
    b.contact ?? "",
    b.age ?? "",
    b.gender ?? "",
    b.category
      ? (BENEFICIARY_CATEGORY_LABELS[b.category as BeneficiaryCategory] ?? b.category)
      : "",
    b.location ?? "",
    b.address ?? "",
    b.annualIncome != null ? b.annualIncome : "",
    b.familyMembers ?? "",
    b.serviceName ?? "",
    b.isUrgentCase ? "Yes" : "No",
    b.isCaseStudy ? "Yes" : "No",
    b.beneficiaryCode ?? "",
    b.notes ?? "",
  ]);
}

export function exportActivityTaskExcel(task: ActivityTask) {
  const sheets = [
    {
      name: "Camp Activity",
      headers: TASK_HEADERS,
      rows: [taskSummaryRow(task)],
    },
  ];

  const benRows = beneficiaryRows(task);
  if (benRows.length > 0) {
    sheets.push({
      name: "Beneficiaries",
      headers: BENEFICIARY_HEADERS,
      rows: benRows,
    });
  }

  exportSheetsToExcel(
    sheets,
    safeExportFilename("camp-activity", task.title.slice(0, 30))
  );
}

export function exportActivityTasksExcel(tasks: ActivityTask[], filterLabel?: string) {
  const sheets = [
    {
      name: "Activities",
      headers: TASK_HEADERS,
      rows: tasks.map(taskSummaryRow),
    },
  ];

  const allBeneficiaries = tasks.flatMap((task) =>
    (task.beneficiaries ?? []).map((b) => [
      task.activityCode ?? "",
      task.title,
      task.projectTitle,
      b.name,
      b.contact ?? "",
      b.age ?? "",
      b.gender ?? "",
      b.category ?? "",
      b.location ?? "",
      b.serviceName ?? "",
    ])
  );

  if (allBeneficiaries.length > 0) {
    sheets.push({
      name: "All Beneficiaries",
      headers: [
        "Activity Code",
        "Activity",
        "Project",
        "Name",
        "Contact",
        "Age",
        "Gender",
        "Category",
        "Location",
        "Service",
      ],
      rows: allBeneficiaries,
    });
  }

  exportSheetsToExcel(sheets, safeExportFilename("field-activities", filterLabel));
}
