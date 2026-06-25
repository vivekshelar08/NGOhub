import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { computeBudgetLineTotal, computeBudgetTotals, formatINR, ProjectProposal, budgetAdminInputFromProject } from "@/lib/projects";
import { loadDonors, resolveDonorLabels } from "@/lib/donors";
import { formatProjectFundingType, formatProjectLocationScope, formatProjectType } from "@/lib/projectMeta";
import { formatSdgLabel, formatSdgList, SDG_GOALS } from "@/lib/sdg";

const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" };
const CELL_BORDERS = {
  top: TABLE_BORDER,
  bottom: TABLE_BORDER,
  left: TABLE_BORDER,
  right: TABLE_BORDER,
};

function safeFilename(title: string, suffix: string) {
  const base = (title || "proposal").replace(/[^\w\s-]/gi, "").trim().replace(/\s+/g, "-");
  return `${base || "proposal"}-${suffix}`;
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

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

function kvTable(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([key, value]) =>
        new TableRow({
          children: [
            new TableCell({
              borders: CELL_BORDERS,
              width: { size: 32, type: WidthType.PERCENTAGE },
              children: [paragraph(key, true)],
            }),
            new TableCell({
              borders: CELL_BORDERS,
              width: { size: 68, type: WidthType.PERCENTAGE },
              children: [paragraph(value)],
            }),
          ],
        })
    ),
  });
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

function proposalBasicRows(project: ProjectProposal, totalEvaluation: number): [string, string][] {
  const donors = loadDonors();
  return [
    ["Status", project.status],
    ["Project Type", formatProjectType(project.projectType)],
    ["Funding Type", formatProjectFundingType(project.fundingType)],
    ["State", project.state || "—"],
    ["District", project.district || "—"],
    ["Geographic Scope", formatProjectLocationScope(project.locationScope)],
    ...(project.locationScope && project.locationScope !== "single"
      ? [
          [
            project.locationScope === "multi_state" ? "States Covered" : "Districts Covered",
            project.coverageAreas || "—",
          ] as [string, string],
        ]
      : []),
    ["Donors", resolveDonorLabels(project.donorIds ?? [], donors)],
    ["Applicant", project.applicantName || "—"],
    ["Location", project.location || "—"],
    ["Intervention Nature", project.interventionNature || "—"],
    ["Duration", project.duration || "—"],
    ["Contact Person", project.contactPerson || "—"],
    ["Target Beneficiaries", project.totalBeneficiaries.toLocaleString("en-IN")],
    ["Total Evaluation (₹)", formatINR(totalEvaluation)],
    ["SDG Alignment", formatSdgList(project.sdgGoals ?? [])],
    ["Created", new Date(project.createdAt).toLocaleDateString("en-IN")],
    ["Last Updated", new Date(project.updatedAt).toLocaleDateString("en-IN")],
  ];
}

function buildSingleProposalSections(project: ProjectProposal) {
  const { directSubtotal, adminOverhead, adminOverheadPercent, totalEvaluation } = computeBudgetTotals(
    project.budget,
    budgetAdminInputFromProject(project)
  );
  const sections: (Paragraph | Table)[] = [
    new Paragraph({
      text: project.title || "Untitled Proposal",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    paragraph(`Generated on ${new Date().toLocaleString("en-IN")}`, false),
    heading("Project Overview"),
    kvTable(proposalBasicRows(project, totalEvaluation)),
    heading("SDG Goals"),
    dataTable(
      ["SDG #", "Goal"],
      (project.sdgGoals ?? []).length
        ? [...project.sdgGoals]
            .sort((a, b) => a - b)
            .map((id) => [String(id), formatSdgLabel(id).replace(/^SDG \d+: /, "")])
        : [["—", "No SDG goals selected"]]
    ),
    heading("Executive Summary"),
    paragraph(project.executiveSummary || "—"),
    heading("About Us"),
    paragraph(project.aboutUs || "—"),
    heading("Activities"),
    dataTable(
      ["Activity", "Timeline", "Milestone Stage", "Target Beneficiaries", "Expected Outcome"],
      project.activities.map((activity) => [
        activity.name || "—",
        activity.timeline || "—",
        activity.milestoneStage || "—",
        activity.targetBeneficiaries.toLocaleString("en-IN"),
        activity.expectedOutcome || "—",
      ])
    ),
    heading("Budget"),
    dataTable(
      ["Head", "Subhead", "Qty", "Duration", "Rate (₹)", "Total (₹)", "Exclude Admin"],
      project.budget.flatMap((category) =>
        category.items.map((item) => [
          category.title || "—",
          item.label || "—",
          item.quantity > 0 ? String(item.quantity) : "—",
          item.duration > 0 ? String(item.duration) : "—",
          formatINR(item.amount),
          formatINR(computeBudgetLineTotal(item)),
          item.excludeAdminCost ? "Yes" : "No",
        ])
      )
    ),
    kvTable([
      ["Direct Subtotal (₹)", formatINR(directSubtotal)],
      ["Admin Overhead (₹)", formatINR(adminOverhead)],
      ["Admin Overhead Rate", `${adminOverheadPercent}%`],
      ["Total Evaluation (₹)", formatINR(totalEvaluation)],
    ]),
  ];

  if (project.setup?.milestones?.length) {
    sections.push(
      heading("Milestones & KPIs"),
      dataTable(
        ["Milestone", "Budget %", "KPI", "Type", "Target"],
        project.setup.milestones.flatMap((milestone) =>
          milestone.kpis.map((kpi) => [
            milestone.name,
            `${milestone.budgetPercent}%`,
            kpi.name,
            kpi.trackingMode,
            kpi.trackingMode === "beneficiaries"
              ? `${kpi.beneficiaryCount.toLocaleString("en-IN")} ben`
              : kpi.trackingMode === "combined"
                ? `${kpi.activityCount} act · ${kpi.beneficiaryCount.toLocaleString("en-IN")} ben`
                : `${kpi.activityCount} act`,
          ])
        )
      )
    );
  }

  return sections;
}

export async function exportProposalWord(project: ProjectProposal) {
  const doc = new Document({
    sections: [{ properties: {}, children: buildSingleProposalSections(project) }],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeFilename(project.title, "proposal")}.docx`);
}

export async function exportProposalPdf(project: ProjectProposal) {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;
  const { directSubtotal, adminOverhead, adminOverheadPercent, totalEvaluation } = computeBudgetTotals(
    project.budget,
    budgetAdminInputFromProject(project)
  );
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 14;

  doc.setFontSize(16);
  doc.text(project.title || "Proposal", 14, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated ${new Date().toLocaleString("en-IN")} · Status: ${project.status}`, 14, y);
  y += 8;
  doc.setTextColor(0);

  autoTable(doc, {
    startY: y,
    head: [["Field", "Value"]],
    body: proposalBasicRows(project, totalEvaluation),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [16, 185, 129] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: y,
    head: [["SDG #", "Goal"]],
    body:
      (project.sdgGoals ?? []).length > 0
        ? [...project.sdgGoals]
            .sort((a, b) => a - b)
            .map((id) => [String(id), formatSdgLabel(id)])
        : [["—", "No SDG goals selected"]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 185, 129] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  doc.setFontSize(11);
  doc.text("Activities", 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Activity", "Timeline", "Stage", "Beneficiaries", "Outcome"]],
    body: project.activities.map((a) => [
      a.name,
      a.timeline,
      a.milestoneStage,
      a.targetBeneficiaries.toLocaleString("en-IN"),
      a.expectedOutcome,
    ]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [16, 185, 129] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  doc.text("Budget", 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Head", "Subhead", "Qty", "Duration", "Rate (₹)", "Total (₹)"]],
    body: project.budget.flatMap((c) =>
      c.items.map((i) => [
        c.title || "—",
        i.label || "—",
        i.quantity > 0 ? String(i.quantity) : "—",
        i.duration > 0 ? String(i.duration) : "—",
        formatINR(i.amount),
        formatINR(computeBudgetLineTotal(i)),
      ])
    ),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [16, 185, 129] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  doc.setFontSize(9);
  doc.text(
    `Direct: ₹${formatINR(directSubtotal)} · Admin: ₹${formatINR(adminOverhead)} · Total: ₹${formatINR(totalEvaluation)}`,
    14,
    y
  );

  doc.save(`${safeFilename(project.title, "proposal")}.pdf`);
}

function reportableProjects(projects: ProjectProposal[]) {
  return projects.filter((p) => p.status !== "DRAFT" && p.title.trim());
}

function sdgSummaryRows(projects: ProjectProposal[]) {
  return SDG_GOALS.map((goal) => {
    const linked = projects.filter((p) => (p.sdgGoals ?? []).includes(goal.id));
    const beneficiaries = linked.reduce((sum, p) => sum + p.totalBeneficiaries, 0);
    const budget = linked.reduce(
      (sum, p) => sum + computeBudgetTotals(p.budget, budgetAdminInputFromProject(p)).totalEvaluation,
      0
    );
    return [
      String(goal.id),
      goal.title,
      String(linked.length),
      beneficiaries.toLocaleString("en-IN"),
      `₹${formatINR(budget)}`,
    ];
  }).filter((row) => Number(row[2]) > 0);
}

export async function exportCombinedSdgReportWord(projects: ProjectProposal[], year?: number) {
  const eligible = reportableProjects(projects);
  const label = year ? `Annual SDG Report ${year}` : "Combined SDG Project Report";
  const sections: (Paragraph | Table)[] = [
    new Paragraph({ text: label, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    paragraph(`Generated on ${new Date().toLocaleString("en-IN")} · ${eligible.length} project(s)`),
    heading("SDG Summary"),
    dataTable(
      ["SDG #", "Goal", "Projects", "Total Beneficiaries", "Total Budget (₹)"],
      sdgSummaryRows(eligible)
    ),
    heading("All Projects"),
    dataTable(
      ["Project", "Status", "Funding", "State", "Beneficiaries", "Budget (₹)", "SDGs"],
      eligible.map((p) => [
        p.title,
        p.status,
        formatProjectFundingType(p.fundingType),
        p.state || "—",
        p.totalBeneficiaries.toLocaleString("en-IN"),
        formatINR(computeBudgetTotals(p.budget, budgetAdminInputFromProject(p)).totalEvaluation),
        (p.sdgGoals ?? []).map((id) => `SDG ${id}`).join(", ") || "—",
      ])
    ),
  ];

  for (const goal of SDG_GOALS) {
    const linked = eligible.filter((p) => (p.sdgGoals ?? []).includes(goal.id));
    if (linked.length === 0) continue;
    sections.push(
      heading(`SDG ${goal.id}: ${goal.title}`),
      dataTable(
        ["Project", "Applicant", "Beneficiaries", "Budget (₹)", "Duration"],
        linked.map((p) => [
          p.title,
          p.applicantName,
          p.totalBeneficiaries.toLocaleString("en-IN"),
          formatINR(computeBudgetTotals(p.budget, budgetAdminInputFromProject(p)).totalEvaluation),
          p.duration || "—",
        ])
      )
    );
  }

  const doc = new Document({ sections: [{ properties: {}, children: sections }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${year ? `sdg-report-${year}` : "sdg-combined-report"}.docx`);
}

export async function exportCombinedSdgReportPdf(projects: ProjectProposal[], year?: number) {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;
  const eligible = reportableProjects(projects);
  const label = year ? `Annual SDG Report ${year}` : "Combined SDG Project Report";
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.text(label, 14, 14);
  doc.setFontSize(9);
  doc.text(`${eligible.length} project(s) · ${new Date().toLocaleDateString("en-IN")}`, 14, 20);

  autoTable(doc, {
    startY: 26,
    head: [["SDG #", "Goal", "Projects", "Beneficiaries", "Budget (₹)"]],
    body: sdgSummaryRows(eligible),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 185, 129] },
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.text("All Projects", 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Project", "Status", "Funding", "State", "Beneficiaries", "Budget", "SDGs"]],
    body: eligible.map((p) => [
      p.title,
      p.status,
      formatProjectFundingType(p.fundingType),
      p.state || "—",
      p.totalBeneficiaries.toLocaleString("en-IN"),
      formatINR(computeBudgetTotals(p.budget, budgetAdminInputFromProject(p)).totalEvaluation),
      (p.sdgGoals ?? []).map((id) => String(id)).join(", "),
    ]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [16, 185, 129] },
  });

  doc.save(`${year ? `sdg-report-${year}` : "sdg-combined-report"}.pdf`);
}

export async function shareProposal(project: ProjectProposal, shareUrl: string): Promise<string> {
  const title = project.title || "Project Proposal";
  const text = `${title} — ${project.applicantName} · ${project.location}\nSDGs: ${formatSdgList(project.sdgGoals ?? [])}\n${shareUrl}`;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url: shareUrl });
      return "Shared successfully.";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return "Share cancelled.";
      }
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return "Proposal link and summary copied to clipboard.";
  }

  throw new Error("Sharing is not supported in this browser.");
}
