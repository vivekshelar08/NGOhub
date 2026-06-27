import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ReportType } from "@/lib/aiReport";
import { exportSheetsToExcel, safeExportFilename, downloadCsv } from "@/lib/excelUtils";
import { exportBeneficiariesExcel, BeneficiaryExportRow } from "@/lib/beneficiaryExport";
import { exportActivityTasksExcel } from "@/lib/activityExport";
import { ActivityTask } from "@/lib/activities";
import { exportMeetingsExcel, MeetingExportRow } from "@/lib/meetingExport";
import {
  exportAchievementsReportExcel,
  exportAchievementsReportPdf,
  exportAchievementsReportWord,
} from "@/lib/achievementExport";
import { AchievementFilters } from "@/lib/achievements";
import { ProjectProposal } from "@/lib/projects";
import {
  ActivityTaskStatus,
  TASK_STATUS_LABELS,
  WORK_TYPE_LABELS,
  ActivityWorkType,
  getTaskBeneficiaryCount,
} from "@/lib/activities";
import { computeCohortReport } from "@/lib/cohortReport";
import { BENEFICIARY_COHORT_LABELS } from "@/lib/service-portal-utils";
import { BeneficiaryCohort } from "@/generated/prisma/enums";

export type ReportExportFormat = "excel" | "csv" | "pdf" | "word";

export interface ReportExportContext {
  reportType: ReportType;
  filterLabel: string;
  beneficiaries: BeneficiaryExportRow[];
  activities: ActivityTask[];
  meetings: MeetingExportRow[];
  projects: ProjectProposal[];
  achievementFilters: AchievementFilters;
  summary: {
    beneficiaryCount: number;
    activityCount: number;
    meetingCount: number;
    completedActivities: number;
    beneficiariesReached: number;
    kpiPct: number | null;
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function filterSummaryLines(ctx: ReportExportContext): string[] {
  return [
    `Report type: ${ctx.reportType}`,
    `Generated: ${new Date().toLocaleString("en-IN")}`,
  ];
}

function activityStatusBreakdown(activities: ActivityTask[]) {
  const counts: Record<string, number> = {};
  for (const task of activities) {
    const label = TASK_STATUS_LABELS[task.status as ActivityTaskStatus] ?? task.status;
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return Object.entries(counts);
}

function activityWorkTypeBreakdown(activities: ActivityTask[]) {
  const counts: Record<string, number> = {};
  for (const task of activities) {
    const label = WORK_TYPE_LABELS[task.workType as ActivityWorkType] ?? task.workType;
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return Object.entries(counts);
}

export async function exportReportSummaryPdf(ctx: ReportExportContext) {
  if (ctx.reportType === "achievements") {
    await exportAchievementsReportPdf(ctx.projects, ctx.achievementFilters);
    return;
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const title =
    ctx.reportType === "combined"
      ? "Combined Organization Report"
      : `${ctx.reportType.charAt(0).toUpperCase()}${ctx.reportType.slice(1)} Report`;

  doc.setFontSize(18);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  filterSummaryLines(ctx).forEach((line, i) => doc.text(line, 14, 28 + i * 5));

  doc.setTextColor(0);
  autoTable(doc, {
    startY: 45,
    head: [["Metric", "Value"]],
    body: [
      ["Beneficiaries", String(ctx.summary.beneficiaryCount)],
      ["Field activities", String(ctx.summary.activityCount)],
      ["Meetings / calendar", String(ctx.summary.meetingCount)],
      ["Completed activities", String(ctx.summary.completedActivities)],
      ["Beneficiaries reached (field)", String(ctx.summary.beneficiariesReached)],
      ["Overall KPI progress", ctx.summary.kpiPct != null ? `${ctx.summary.kpiPct}%` : "—"],
    ],
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129] },
  });

  const statusRows = activityStatusBreakdown(ctx.activities);
  if (statusRows.length > 0) {
    autoTable(doc, {
      startY: (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 10,
      head: [["Activity status", "Count"]],
      body: statusRows,
      theme: "striped",
    });
  }

  doc.save(`${safeExportFilename("ngo-report", ctx.filterLabel)}.pdf`);
}

export async function exportReportSummaryWord(ctx: ReportExportContext) {
  if (ctx.reportType === "achievements") {
    await exportAchievementsReportWord(ctx.projects, ctx.achievementFilters);
    return;
  }

  const statusRows = activityStatusBreakdown(ctx.activities);
  const workTypeRows = activityWorkTypeBreakdown(ctx.activities);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "Svitech HR Report Summary",
            heading: HeadingLevel.HEADING_1,
          }),
          ...filterSummaryLines(ctx).map(
            (line) =>
              new Paragraph({
                children: [new TextRun({ text: line })],
                spacing: { after: 80 },
              })
          ),
          new Paragraph({
            text: "Key metrics",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Beneficiaries: ${ctx.summary.beneficiaryCount}`, break: 1 }),
              new TextRun({ text: `Field activities: ${ctx.summary.activityCount}`, break: 1 }),
              new TextRun({ text: `Meetings: ${ctx.summary.meetingCount}`, break: 1 }),
              new TextRun({
                text: `KPI progress: ${ctx.summary.kpiPct ?? "—"}%`,
                break: 1,
              }),
            ],
            spacing: { after: 200 },
          }),
          ...(statusRows.length
            ? [
                new Paragraph({
                  text: "Activity status breakdown",
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 200, after: 120 },
                }),
                ...statusRows.map(
                  ([label, count]) =>
                    new Paragraph({
                      children: [new TextRun({ text: `${label}: ${count}` })],
                      spacing: { after: 60 },
                    })
                ),
              ]
            : []),
          ...(workTypeRows.length
            ? [
                new Paragraph({
                  text: "Work type breakdown",
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 200, after: 120 },
                }),
                ...workTypeRows.map(
                  ([label, count]) =>
                    new Paragraph({
                      children: [new TextRun({ text: `${label}: ${count}` })],
                      spacing: { after: 60 },
                    })
                ),
              ]
            : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeExportFilename("ngo-report", ctx.filterLabel)}.docx`);
}

function exportActivitiesCsv(activities: ActivityTask[], filterLabel: string) {
  const headers = ["Title", "Project", "Status", "Work Type", "Scheduled", "Beneficiaries"];
  const rows = activities.map((t) => [
    t.title,
    t.projectTitle,
    TASK_STATUS_LABELS[t.status as ActivityTaskStatus],
    WORK_TYPE_LABELS[t.workType as ActivityWorkType],
    t.scheduledDate?.slice(0, 10) ?? "",
    getTaskBeneficiaryCount(t),
  ]);
  downloadCsv(headers, rows, safeExportFilename("activities", filterLabel));
}

function exportBeneficiariesCsv(beneficiaries: BeneficiaryExportRow[], filterLabel: string) {
  const headers = ["Code", "Name", "Category", "Mobile", "Location", "Urgent", "Services"];
  const rows = beneficiaries.map((b) => [
    b.beneficiaryCode,
    b.name,
    b.category,
    b.mobile ?? "",
    b.location ?? "",
    b.isUrgentCase ? "Yes" : "No",
    b.deliveries?.length ?? 0,
  ]);
  downloadCsv(headers, rows, safeExportFilename("beneficiaries", filterLabel));
}

function exportMeetingsCsv(meetings: MeetingExportRow[], filterLabel: string) {
  const headers = ["Title", "Status", "Date", "Project", "Requested By"];
  const rows = meetings.map((m) => [
    m.title,
    m.status ?? "",
    m.scheduledDate?.slice(0, 10) ?? "",
    m.projectTitle ?? "",
    m.requestedByName ?? "",
  ]);
  downloadCsv(headers, rows, safeExportFilename("meetings", filterLabel));
}

export async function exportReportByFormat(ctx: ReportExportContext, format: ReportExportFormat) {
  const { reportType, filterLabel } = ctx;

  if (format === "pdf") {
    await exportReportSummaryPdf(ctx);
    return;
  }
  if (format === "word") {
    await exportReportSummaryWord(ctx);
    return;
  }

  if (format === "excel") {
    switch (reportType) {
      case "beneficiaries":
        exportBeneficiariesExcel(ctx.beneficiaries, { filterLabel });
        break;
      case "activities":
        exportActivityTasksExcel(ctx.activities, filterLabel);
        break;
      case "meetings":
        exportMeetingsExcel(ctx.meetings, filterLabel);
        break;
      case "achievements":
        await exportAchievementsReportExcel(ctx.projects, ctx.achievementFilters);
        break;
      case "combined":
        exportBeneficiariesExcel(ctx.beneficiaries, { filterLabel: "combined-beneficiaries" });
        exportActivityTasksExcel(ctx.activities, "combined-activities");
        exportMeetingsExcel(ctx.meetings, "combined-meetings");
        break;
    }
    return;
  }

  if (format === "csv") {
    switch (reportType) {
      case "beneficiaries":
        exportBeneficiariesCsv(ctx.beneficiaries, filterLabel);
        break;
      case "activities":
        exportActivitiesCsv(ctx.activities, filterLabel);
        break;
      case "meetings":
        exportMeetingsCsv(ctx.meetings, filterLabel);
        break;
      case "combined":
        exportBeneficiariesCsv(ctx.beneficiaries, "combined-beneficiaries");
        exportActivitiesCsv(ctx.activities, "combined-activities");
        exportMeetingsCsv(ctx.meetings, "combined-meetings");
        break;
      case "achievements":
        await exportAchievementsReportExcel(ctx.projects, ctx.achievementFilters);
        break;
    }
  }
}

export async function exportAllFilteredData(ctx: ReportExportContext) {
  const sheets = [];

  if (ctx.beneficiaries.length > 0) {
    sheets.push({
      name: "Beneficiaries",
      headers: ["Code", "Name", "Category", "Cohorts", "Mobile", "Location", "Urgent", "Services"],
      rows: ctx.beneficiaries.map((b) => [
        b.beneficiaryCode,
        b.name,
        b.category,
        (b.cohorts as BeneficiaryCohort[] | undefined)
          ?.map((c) => BENEFICIARY_COHORT_LABELS[c])
          .join(", ") ?? "",
        b.mobile ?? "",
        b.location ?? "",
        b.isUrgentCase ? "Yes" : "No",
        b.deliveries?.length ?? 0,
      ]),
    });

    const cohortSummary = computeCohortReport(ctx.beneficiaries);
    if (cohortSummary.byCohort.length > 0) {
      sheets.push({
        name: "Special Groups",
        headers: ["Cohort", "Count", "% of tagged", "% of all"],
        rows: cohortSummary.byCohort.map((row) => [
          row.label,
          row.count,
          `${row.pctOfTagged}%`,
          `${row.pctOfAll}%`,
        ]),
      });
    }
  }

  if (ctx.activities.length > 0) {
    sheets.push({
      name: "Activities",
      headers: ["Title", "Project", "Status", "Work Type", "Scheduled", "Beneficiaries"],
      rows: ctx.activities.map((t) => [
        t.title,
        t.projectTitle,
        TASK_STATUS_LABELS[t.status as ActivityTaskStatus],
        WORK_TYPE_LABELS[t.workType as ActivityWorkType],
        t.scheduledDate?.slice(0, 10) ?? "",
        getTaskBeneficiaryCount(t),
      ]),
    });
  }

  if (ctx.meetings.length > 0) {
    sheets.push({
      name: "Meetings",
      headers: ["Title", "Status", "Date", "Project", "Requested By"],
      rows: ctx.meetings.map((m) => [
        m.title,
        m.status ?? "",
        m.scheduledDate?.slice(0, 10) ?? "",
        m.projectTitle ?? "",
        m.requestedByName ?? "",
      ]),
    });
  }

  sheets.push({
    name: "Summary",
    headers: ["Metric", "Value"],
    rows: [
      ["Beneficiaries", ctx.summary.beneficiaryCount],
      ["Activities", ctx.summary.activityCount],
      ["Meetings", ctx.summary.meetingCount],
      ["Completed activities", ctx.summary.completedActivities],
      ["Beneficiaries reached", ctx.summary.beneficiariesReached],
      ["KPI progress %", ctx.summary.kpiPct ?? "—"],
      ["Report type", ctx.reportType],
      ["Generated at", new Date().toLocaleString("en-IN")],
    ],
  });

  exportSheetsToExcel(sheets, safeExportFilename("ngo-full-data-export", ctx.filterLabel));
}
