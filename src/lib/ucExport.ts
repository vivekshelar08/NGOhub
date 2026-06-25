import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
import { ProjectProposal, formatINR, computeBudgetTotals, budgetAdminInputFromProject } from "@/lib/projects";
import type { ProjectBudgetSummary } from "@/lib/budgetTracking";

export async function generateUcDocx(
  project: ProjectProposal,
  budget: ProjectBudgetSummary,
  periodLabel: string,
  orgName = "SVITECH Foundation"
): Promise<Blob> {
  const totals = computeBudgetTotals(project.budget ?? [], budgetAdminInputFromProject(project));
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "Utilization Certificate (Draft)", bold: true })],
          }),
          new Paragraph({ children: [new TextRun(`Organization: ${orgName}`)] }),
          new Paragraph({ children: [new TextRun(`Project: ${project.title}`)] }),
          new Paragraph({ children: [new TextRun(`Period: ${periodLabel}`)] }),
          new Paragraph({ children: [new TextRun(`Date: ${new Date().toLocaleDateString("en-IN")}`)] }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun(
                "This is a system-generated draft UC based on approved expenses and project budget. Review and sign before sharing with CSR donors."
              ),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Fund summary")] }),
          new Paragraph({ children: [new TextRun(`Total project budget: ₹${formatINR(totals.totalEvaluation)}`)] }),
          new Paragraph({ children: [new TextRun(`Total utilized: ₹${formatINR(budget.totalSpent)}`)] }),
          new Paragraph({ children: [new TextRun(`Balance: ₹${formatINR(budget.totalRemaining)}`)] }),
          new Paragraph({ text: "" }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Budget head breakdown")] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ["Budget head", "Budgeted", "Spent", "Balance"].map(
                  (h) =>
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                    })
                ),
              }),
              ...budget.rows.map(
                (r) =>
                  new TableRow({
                    children: [
                      r.head,
                      `₹${formatINR(r.budgeted)}`,
                      `₹${formatINR(r.spent)}`,
                      `₹${formatINR(r.remaining)}`,
                    ].map((t) => new TableCell({ children: [new Paragraph(t)] })),
                  })
              ),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun("Authorized signatory: _________________________")] }),
          new Paragraph({ children: [new TextRun("Date: _________________________")] }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
