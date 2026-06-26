import { BeneficiaryCohort } from "@/generated/prisma/enums";
import { BeneficiaryExportRow } from "@/lib/beneficiaryExport";
import { exportSheetsToExcel, safeExportFilename } from "@/lib/excelUtils";
import {
  BENEFICIARY_COHORT_LABELS,
  BENEFICIARY_COHORT_OPTIONS,
} from "@/lib/service-portal-utils";

export interface CohortCountRow {
  cohort: BeneficiaryCohort;
  label: string;
  count: number;
  pctOfTagged: number;
  pctOfAll: number;
}

export interface CohortProjectRow {
  projectId: string;
  projectTitle: string;
  total: number;
  tagged: number;
  byCohort: Record<BeneficiaryCohort, number>;
}

export interface CohortReportSummary {
  totalBeneficiaries: number;
  taggedBeneficiaries: number;
  untaggedBeneficiaries: number;
  multiCohortBeneficiaries: number;
  byCohort: CohortCountRow[];
  byProject: CohortProjectRow[];
}

const ALL_COHORTS = BENEFICIARY_COHORT_OPTIONS.map((o) => o.value);

function emptyCohortCounts(): Record<BeneficiaryCohort, number> {
  return Object.fromEntries(ALL_COHORTS.map((c) => [c, 0])) as Record<BeneficiaryCohort, number>;
}

export function computeCohortReport(
  beneficiaries: BeneficiaryExportRow[],
  projectTitles: Map<string, string> = new Map()
): CohortReportSummary {
  const cohortCounts = emptyCohortCounts();
  let tagged = 0;
  let multiCohort = 0;

  const projectMap = new Map<
    string,
    { total: number; tagged: number; byCohort: Record<BeneficiaryCohort, number> }
  >();

  for (const b of beneficiaries) {
    const cohorts = (b.cohorts ?? []) as BeneficiaryCohort[];
    const projectKey = b.projectId ?? "unknown";
    const bucket = projectMap.get(projectKey) ?? {
      total: 0,
      tagged: 0,
      byCohort: emptyCohortCounts(),
    };
    bucket.total += 1;

    if (cohorts.length > 0) {
      tagged += 1;
      bucket.tagged += 1;
      if (cohorts.length > 1) multiCohort += 1;
      for (const cohort of cohorts) {
        if (cohort in cohortCounts) {
          cohortCounts[cohort] += 1;
          bucket.byCohort[cohort] += 1;
        }
      }
    }

    projectMap.set(projectKey, bucket);
  }

  const total = beneficiaries.length;
  const byCohort: CohortCountRow[] = ALL_COHORTS.map((cohort) => {
    const count = cohortCounts[cohort];
    return {
      cohort,
      label: BENEFICIARY_COHORT_LABELS[cohort],
      count,
      pctOfTagged: tagged > 0 ? Math.round((count / tagged) * 100) : 0,
      pctOfAll: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  }).filter((row) => row.count > 0);

  const byProject: CohortProjectRow[] = [...projectMap.entries()]
    .map(([projectId, data]) => ({
      projectId,
      projectTitle:
        projectTitles.get(projectId) ??
        beneficiaries.find((b) => b.projectId === projectId)?.projectTitle ??
        (projectId === "unknown" ? "Unassigned" : projectId),
      total: data.total,
      tagged: data.tagged,
      byCohort: data.byCohort,
    }))
    .sort((a, b) => b.tagged - a.tagged || a.projectTitle.localeCompare(b.projectTitle));

  return {
    totalBeneficiaries: total,
    taggedBeneficiaries: tagged,
    untaggedBeneficiaries: total - tagged,
    multiCohortBeneficiaries: multiCohort,
    byCohort,
    byProject,
  };
}

export function exportCohortReportExcel(
  summary: CohortReportSummary,
  beneficiaries: BeneficiaryExportRow[],
  filterLabel?: string
) {
  const cohortHeaders = ["Cohort", "Beneficiaries", "% of tagged", "% of all enrolled"];
  const cohortRows = summary.byCohort.map((row) => [
    row.label,
    row.count,
    `${row.pctOfTagged}%`,
    `${row.pctOfAll}%`,
  ]);

  const projectHeaders = [
    "Project",
    "Total beneficiaries",
    "With cohort tags",
    ...ALL_COHORTS.map((c) => BENEFICIARY_COHORT_LABELS[c]),
  ];
  const projectRows = summary.byProject.map((row) => [
    row.projectTitle,
    row.total,
    row.tagged,
    ...ALL_COHORTS.map((c) => row.byCohort[c] || 0),
  ]);

  const detailHeaders = [
    "Code",
    "Name",
    "Project",
    "Cohorts",
    "Category",
    "Mobile",
    "Location",
  ];
  const detailRows = beneficiaries
    .filter((b) => (b.cohorts?.length ?? 0) > 0)
    .map((b) => [
      b.beneficiaryCode,
      b.name,
      b.projectTitle ?? b.projectId ?? "",
      (b.cohorts as BeneficiaryCohort[] | undefined)
        ?.map((c) => BENEFICIARY_COHORT_LABELS[c])
        .join(", ") ?? "",
      b.category,
      b.mobile ?? "",
      b.location ?? "",
    ]);

  exportSheetsToExcel(
    [
      {
        name: "Cohort Summary",
        headers: cohortHeaders,
        rows:
          cohortRows.length > 0
            ? cohortRows
            : [["No cohort tags recorded", 0, "—", "—"]],
      },
      {
        name: "By Project",
        headers: projectHeaders,
        rows: projectRows,
      },
      {
        name: "Tagged Beneficiaries",
        headers: detailHeaders,
        rows: detailRows,
      },
      {
        name: "Overview",
        headers: ["Metric", "Value"],
        rows: [
          ["Total beneficiaries", summary.totalBeneficiaries],
          ["With at least one cohort", summary.taggedBeneficiaries],
          ["Without cohort tags", summary.untaggedBeneficiaries],
          ["Multiple cohorts", summary.multiCohortBeneficiaries],
          ["Generated at", new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })],
        ],
      },
    ],
    safeExportFilename("cohort-special-groups-report", filterLabel)
  );
}
