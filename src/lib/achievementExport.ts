import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
} from "docx";
import {
  AchievementFilters,
  ACHIEVEMENT_STATUS_LABELS,
  filterAchievements,
  computeAllProjectAchievements,
  ProjectAchievement,
  overviewFromFiltered,
} from "@/lib/achievements";
import { ProjectProposal } from "@/lib/projects";
import { formatSdgLabel } from "@/lib/sdg";

const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" };
const CELL_BORDERS = {
  top: TABLE_BORDER,
  bottom: TABLE_BORDER,
  left: TABLE_BORDER,
  right: TABLE_BORDER,
};

function safeFilename(suffix: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `achievements-report-${date}-${suffix}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function paragraph(text: string, bold = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold })],
    spacing: { after: 120 },
  });
}

function heading(text: string) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } });
}

function dataTable(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map(
          (header) =>
            new TableCell({
              borders: CELL_BORDERS,
              children: [paragraph(header, true)],
            })
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  borders: CELL_BORDERS,
                  children: [paragraph(cell)],
                })
            ),
          })
      ),
    ],
  });
}

function formatPct(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function filterSummary(filters: AchievementFilters): string {
  const parts: string[] = [];
  if (filters.status !== "ALL") {
    parts.push(`Status: ${ACHIEVEMENT_STATUS_LABELS[filters.status]}`);
  }
  if (filters.projectId !== "ALL") {
    parts.push("Project filter applied");
  }
  if (filters.sdgGoal !== "ALL") {
    parts.push(formatSdgLabel(filters.sdgGoal));
  }
  if (filters.query.trim()) {
    parts.push(`Search: "${filters.query.trim()}"`);
  }
  return parts.length ? parts.join(" · ") : "All active projects";
}

function buildAchievementRows(achievements: ProjectAchievement[]) {
  return achievements.flatMap((project) =>
    project.kpis.map((kpi) => [
      project.projectTitle,
      project.location || "—",
      kpi.milestoneName,
      kpi.kpiName,
      kpi.trackingMode,
      kpi.targetActivities.toLocaleString("en-IN"),
      kpi.achievedActivities.toLocaleString("en-IN"),
      kpi.targetBeneficiaries.toLocaleString("en-IN"),
      kpi.achievedBeneficiaries.toLocaleString("en-IN"),
      formatPct(kpi.overallPct),
      ACHIEVEMENT_STATUS_LABELS[kpi.status],
    ])
  );
}

function resolveAchievements(projects: ProjectProposal[], filters: AchievementFilters) {
  const all = computeAllProjectAchievements(projects);
  const filtered = filterAchievements(all, filters);
  const overview = overviewFromFiltered(filtered);
  return { filtered, overview };
}

export async function exportAchievementsReportWord(
  projects: ProjectProposal[],
  filters: AchievementFilters
) {
  const { filtered, overview } = resolveAchievements(projects, filters);

  const sections = [
    new Paragraph({
      text: "Achievements Dashboard Report",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    paragraph(`Generated on ${new Date().toLocaleString("en-IN")}`),
    paragraph(`Filters: ${filterSummary(filters)}`),
    heading("Overall Summary"),
    dataTable(
      ["Metric", "Target", "Achieved", "Progress"],
      [
        [
          "Activities",
          overview.targetActivities.toLocaleString("en-IN"),
          overview.achievedActivities.toLocaleString("en-IN"),
          formatPct(overview.activityPct),
        ],
        [
          "Beneficiaries",
          overview.targetBeneficiaries.toLocaleString("en-IN"),
          overview.achievedBeneficiaries.toLocaleString("en-IN"),
          formatPct(overview.beneficiaryPct),
        ],
        ["Overall", "—", "—", formatPct(overview.overallPct)],
      ]
    ),
    heading("Status Breakdown"),
    dataTable(
      ["Status", "Projects"],
      (Object.keys(overview.byStatus) as (keyof typeof overview.byStatus)[]).map((key) => [
        ACHIEVEMENT_STATUS_LABELS[key],
        String(overview.byStatus[key]),
      ])
    ),
    heading("Projects"),
    dataTable(
      ["Project", "Location", "Activities", "Beneficiaries", "Progress", "Status"],
      filtered.map((p) => [
        p.projectTitle,
        p.location || "—",
        `${p.achievedActivities.toLocaleString("en-IN")} / ${p.targetActivities.toLocaleString("en-IN")}`,
        `${p.achievedBeneficiaries.toLocaleString("en-IN")} / ${p.targetBeneficiaries.toLocaleString("en-IN")}`,
        formatPct(p.overallPct),
        ACHIEVEMENT_STATUS_LABELS[p.status],
      ])
    ),
    heading("KPI Detail"),
    dataTable(
      [
        "Project",
        "Location",
        "Milestone",
        "KPI",
        "Mode",
        "Target Activities",
        "Achieved Activities",
        "Target Beneficiaries",
        "Achieved Beneficiaries",
        "Progress",
        "Status",
      ],
      buildAchievementRows(filtered)
    ),
  ];

  const doc = new Document({ sections: [{ properties: {}, children: sections }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeFilename("report")}.docx`);
}

export async function exportAchievementsReportPdf(
  projects: ProjectProposal[],
  filters: AchievementFilters
) {
  const { filtered, overview } = resolveAchievements(projects, filters);
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape" });
  let y = 14;

  doc.setFontSize(16);
  doc.text("Achievements Dashboard Report", 14, y);
  y += 8;
  doc.setFontSize(9);
  doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, 14, y);
  y += 5;
  doc.text(`Filters: ${filterSummary(filters)}`, 14, y);
  y += 8;

  doc.setFontSize(11);
  doc.text("Overall Summary", 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Target", "Achieved", "Progress"]],
    body: [
      [
        "Activities",
        overview.targetActivities.toLocaleString("en-IN"),
        overview.achievedActivities.toLocaleString("en-IN"),
        formatPct(overview.activityPct),
      ],
      [
        "Beneficiaries",
        overview.targetBeneficiaries.toLocaleString("en-IN"),
        overview.achievedBeneficiaries.toLocaleString("en-IN"),
        formatPct(overview.beneficiaryPct),
      ],
      ["Overall", "—", "—", formatPct(overview.overallPct)],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 185, 129] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  doc.text("Status Breakdown", 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Status", "Projects"]],
    body: (Object.keys(overview.byStatus) as (keyof typeof overview.byStatus)[]).map((key) => [
      ACHIEVEMENT_STATUS_LABELS[key],
      String(overview.byStatus[key]),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 185, 129] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  doc.text("Projects", 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Project", "Location", "Activities", "Beneficiaries", "Progress", "Status"]],
    body: filtered.map((p) => [
      p.projectTitle,
      p.location || "—",
      `${p.achievedActivities} / ${p.targetActivities}`,
      `${p.achievedBeneficiaries} / ${p.targetBeneficiaries}`,
      formatPct(p.overallPct),
      ACHIEVEMENT_STATUS_LABELS[p.status],
    ]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [16, 185, 129] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (y > 170) {
    doc.addPage();
    y = 14;
  }

  doc.text("KPI Detail", 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [
      [
        "Project",
        "Milestone",
        "KPI",
        "Target Act.",
        "Achieved Act.",
        "Target Ben.",
        "Achieved Ben.",
        "Progress",
        "Status",
      ],
    ],
    body: filtered.flatMap((project) =>
      project.kpis.map((kpi) => [
        project.projectTitle,
        kpi.milestoneName,
        kpi.kpiName,
        String(kpi.targetActivities),
        String(kpi.achievedActivities),
        String(kpi.targetBeneficiaries),
        String(kpi.achievedBeneficiaries),
        formatPct(kpi.overallPct),
        ACHIEVEMENT_STATUS_LABELS[kpi.status],
      ])
    ),
    styles: { fontSize: 6 },
    headStyles: { fillColor: [16, 185, 129] },
  });

  doc.save(`${safeFilename("report")}.pdf`);
}

export async function exportAchievementsReportExcel(
  projects: ProjectProposal[],
  filters: AchievementFilters
) {
  const { exportSheetsToExcel, safeExportFilename } = await import("@/lib/excelUtils");
  const { filtered, overview } = resolveAchievements(projects, filters);

  exportSheetsToExcel(
    [
      {
        name: "Summary",
        headers: ["Metric", "Target", "Achieved", "Progress"],
        rows: [
          [
            "Activities",
            overview.targetActivities,
            overview.achievedActivities,
            formatPct(overview.activityPct),
          ],
          [
            "Beneficiaries",
            overview.targetBeneficiaries,
            overview.achievedBeneficiaries,
            formatPct(overview.beneficiaryPct),
          ],
          ["Overall", "—", "—", formatPct(overview.overallPct)],
        ],
      },
      {
        name: "Projects",
        headers: [
          "Project",
          "Location",
          "Target Activities",
          "Achieved Activities",
          "Target Beneficiaries",
          "Achieved Beneficiaries",
          "Progress",
          "Status",
        ],
        rows: filtered.map((p) => [
          p.projectTitle,
          p.location || "—",
          p.targetActivities,
          p.achievedActivities,
          p.targetBeneficiaries,
          p.achievedBeneficiaries,
          formatPct(p.overallPct),
          ACHIEVEMENT_STATUS_LABELS[p.status],
        ]),
      },
      {
        name: "KPI Detail",
        headers: [
          "Project",
          "Milestone",
          "KPI",
          "Mode",
          "Target Act.",
          "Achieved Act.",
          "Target Ben.",
          "Achieved Ben.",
          "Progress",
          "Status",
        ],
        rows: buildAchievementRows(filtered),
      },
    ],
    safeExportFilename("achievements-report", filterSummary(filters).slice(0, 30))
  );
}
