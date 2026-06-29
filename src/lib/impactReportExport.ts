import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import jsPDF from "jspdf";
import { ImpactReportResult } from "@/lib/aiReport";
import {
  dataUrlToUint8Array,
  renderBarChartImage,
  renderPieChartImage,
  renderProgressChartImage,
} from "@/lib/impactChartCanvas";
import { safeExportFilename } from "@/lib/excelUtils";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export interface ImpactChartImages {
  activityStatus?: string;
  beneficiaryCategory?: string;
  activityTrend?: string;
  kpiProgress?: string;
}

export function buildImpactChartImages(result: ImpactReportResult): ImpactChartImages {
  const { charts } = result;
  const images: ImpactChartImages = {};

  if (charts.activityStatus.length > 0) {
    images.activityStatus = renderBarChartImage(charts.activityStatus, {
      title: "Field Activities by Status",
      color: "#10b981",
    });
  }
  if (charts.beneficiaryCategory.length > 0) {
    images.beneficiaryCategory = renderPieChartImage(charts.beneficiaryCategory, {
      title: "Beneficiaries by Category",
    });
  }
  if (charts.activityTrend.length > 0) {
    images.activityTrend = renderBarChartImage(
      charts.activityTrend.map((d) => ({ name: d.month, value: d.count as number })),
      { title: "Monthly Activity Volume", color: "#6366f1" }
    );
  }
  images.kpiProgress = renderProgressChartImage(
    [
      {
        label: "Activities",
        pct: charts.kpiProgress.activityPct,
        achieved: charts.kpiProgress.achievedActivities,
        target: charts.kpiProgress.targetActivities,
      },
      {
        label: "Beneficiaries",
        pct: charts.kpiProgress.beneficiaryPct,
        achieved: charts.kpiProgress.achievedBeneficiaries,
        target: charts.kpiProgress.targetBeneficiaries,
      },
    ],
    { title: "KPI Achievement Progress" }
  );

  return images;
}

function narrativeParagraphs(narrative: string): Paragraph[] {
  return narrative.split(/\n\n+/).flatMap((block) => {
    const trimmed = block.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("# ")) {
      return [
        new Paragraph({
          text: trimmed.replace(/^#+\s*/, ""),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        }),
      ];
    }
    if (trimmed.startsWith("## ")) {
      return [
        new Paragraph({
          text: trimmed.replace(/^#+\s*/, ""),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        }),
      ];
    }
    if (trimmed.startsWith("### ")) {
      return [
        new Paragraph({
          text: trimmed.replace(/^#+\s*/, ""),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80 },
        }),
      ];
    }
    if (trimmed.startsWith("- ")) {
      return trimmed
        .split("\n")
        .filter((l) => l.startsWith("- "))
        .map(
          (line) =>
            new Paragraph({
              children: [new TextRun({ text: line.replace(/^- /, "• ") })],
              spacing: { after: 60 },
              indent: { left: 360 },
            })
        );
    }

    return [
      new Paragraph({
        children: [new TextRun({ text: trimmed.replace(/\*\*/g, "") })],
        spacing: { after: 120 },
      }),
    ];
  });
}

function imageParagraph(dataUrl: string, width = 480, height = 220): Paragraph | null {
  if (!dataUrl) return null;
  try {
    const data = dataUrlToUint8Array(dataUrl);
    return new Paragraph({
      children: [
        new ImageRun({
          data,
          transformation: { width, height },
          type: "png",
        }),
      ],
      spacing: { before: 120, after: 120 },
    });
  } catch {
    return null;
  }
}

export async function exportImpactReportWord(
  result: ImpactReportResult,
  chartImages: ImpactChartImages
) {
  const children: Paragraph[] = [
    new Paragraph({
      text: "NGO Impact Report",
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated ${new Date(result.generatedAt).toLocaleString("en-IN")} · ${result.filterSummary}`,
          italics: true,
          color: "64748B",
        }),
      ],
      spacing: { after: 200 },
    }),
    ...narrativeParagraphs(result.narrative),
  ];

  const chartBlocks = [
    { img: chartImages.kpiProgress, h: 180 },
    { img: chartImages.activityStatus, h: 220 },
    { img: chartImages.beneficiaryCategory, h: 220 },
    { img: chartImages.activityTrend, h: 220 },
  ];

  children.push(
    new Paragraph({
      text: "Supporting Charts",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 120 },
    })
  );

  for (const block of chartBlocks) {
    const para = block.img ? imageParagraph(block.img, 480, block.h) : null;
    if (para) children.push(para);
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeExportFilename("ngo-impact-report", result.filterSummary)}.docx`);
}

export function exportImpactReportPdf(result: ImpactReportResult, chartImages: ImpactChartImages) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("NGO Impact Report", 14, y);
  y += 10;

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `Generated ${new Date(result.generatedAt).toLocaleString("en-IN")} · ${result.filterSummary}`,
    14,
    y
  );
  y += 12;

  doc.setFontSize(10);
  doc.setTextColor(30);

  const lines = doc.splitTextToSize(
    result.narrative.replace(/^#+\s*/gm, "").replace(/\*\*/g, ""),
    pageWidth - 28
  );

  for (const line of lines) {
    if (y > 270) {
      doc.addPage();
      y = 18;
    }
    doc.text(line, 14, y);
    y += 5;
  }

  const charts = [
    { dataUrl: chartImages.kpiProgress, title: "KPI Progress" },
    { dataUrl: chartImages.activityStatus, title: "Activity Status" },
    { dataUrl: chartImages.beneficiaryCategory, title: "Beneficiary Categories" },
    { dataUrl: chartImages.activityTrend, title: "Activity Trend" },
  ].filter((c) => c.dataUrl);

  if (charts.length > 0) {
    doc.addPage();
    y = 18;
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("Supporting Charts", 14, y);
    y += 10;

    for (const chart of charts) {
      if (y > 200) {
        doc.addPage();
        y = 18;
      }
      doc.setFontSize(11);
      doc.text(chart.title, 14, y);
      y += 4;
      const imgW = pageWidth - 28;
      const imgH = 55;
      doc.addImage(chart.dataUrl!, "PNG", 14, y, imgW, imgH);
      y += imgH + 14;
    }
  }

  doc.save(`${safeExportFilename("ngo-impact-report", result.filterSummary)}.pdf`);
}

export function exportImpactReportMarkdown(result: ImpactReportResult, chartImages: ImpactChartImages) {
  const sections = [result.narrative, "", "---", "", "## Charts", ""];

  const chartEntries: [string, string | undefined][] = [
    ["KPI Achievement Progress", chartImages.kpiProgress],
    ["Field Activities by Status", chartImages.activityStatus],
    ["Beneficiaries by Category", chartImages.beneficiaryCategory],
    ["Monthly Activity Volume", chartImages.activityTrend],
  ];

  for (const [title, dataUrl] of chartEntries) {
    if (dataUrl) {
      sections.push(`### ${title}`, "", `![${title}](${dataUrl})`, "");
    }
  }

  sections.push(
    "",
    "---",
    "",
    `*Report generated on ${new Date(result.generatedAt).toLocaleString("en-IN")} using ${result.provider} narrative engine.*`
  );

  const blob = new Blob([sections.join("\n")], { type: "text/markdown" });
  downloadBlob(blob, `${safeExportFilename("ngo-impact-report", result.filterSummary)}.md`);
}
