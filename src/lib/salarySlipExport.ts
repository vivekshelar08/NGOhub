import { SalarySlipData, formatINR } from "@/lib/salary-slip";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportSalarySlipPdf(slip: SalarySlipData) {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(slip.organizationName, 14, 14);
  doc.setFontSize(11);
  doc.text("Salary Slip", 14, 22);
  doc.setTextColor(0);
  y = 36;

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Slip No: ${slip.slipNumber}`, 14, y);
  doc.text(`Pay Period: ${slip.payPeriod.start} to ${slip.payPeriod.end}`, 14, y + 5);
  doc.text(`Pay Date: ${slip.payDate}`, 14, y + 10);
  doc.text(`Status: ${slip.payrollStatus}`, pageWidth - 14, y, { align: "right" });
  y += 18;
  doc.setTextColor(0);

  autoTable(doc, {
    startY: y,
    head: [["Employee Details", ""]],
    body: [
      ["Name", slip.employee.name],
      ["Employee Code", slip.employee.employeeCode ?? "—"],
      ["Designation", slip.employee.designation ?? "—"],
      ["Department", slip.employee.department ?? "—"],
      ["PAN", slip.employee.panNumber ?? "—"],
      ["UAN", slip.employee.uanNumber ?? "—"],
      ["Bank", slip.employee.bankName ?? "—"],
      ["Account", slip.employee.bankAccountNumber ?? "—"],
      ["IFSC", slip.employee.bankIfsc ?? "—"],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  const colWidth = (pageWidth - 28) / 2 - 4;

  autoTable(doc, {
    startY: y,
    margin: { left: 14 },
    tableWidth: colWidth,
    head: [["Earnings", "Amount (₹)"]],
    body: [
      ...slip.earnings.map((e) => [e.label, formatINR(e.amount)]),
      [{ content: "Gross Pay", styles: { fontStyle: "bold" } }, { content: formatINR(slip.grossPay), styles: { fontStyle: "bold" } }],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [16, 185, 129] },
  });

  const earningsEndY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: y,
    margin: { left: 14 + colWidth + 8 },
    tableWidth: colWidth,
    head: [["Deductions", "Amount (₹)"]],
    body: [
      ...(slip.deductions.length > 0
        ? slip.deductions.map((d) => [d.label, formatINR(d.amount)])
        : [["—", formatINR(0)]]),
      [
        { content: "Total Deductions", styles: { fontStyle: "bold" } },
        { content: formatINR(slip.totalDeductions), styles: { fontStyle: "bold" } },
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [239, 68, 68] },
  });

  y = Math.max(earningsEndY, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY) + 10;

  doc.setFillColor(236, 253, 245);
  doc.roundedRect(14, y, pageWidth - 28, 14, 2, 2, "F");
  doc.setFontSize(12);
  doc.setTextColor(6, 95, 70);
  doc.text(`Net Pay: ${formatINR(slip.netPay)}`, pageWidth / 2, y + 9, { align: "center" });
  y += 22;

  doc.setFontSize(8);
  doc.setTextColor(100);
  autoTable(doc, {
    startY: y,
    head: [["Attendance Summary", "Days"]],
    body: [
      ["Present", String(slip.attendanceSummary.presentDays)],
      ["Half Days", String(slip.attendanceSummary.halfDays)],
      ["Leave", String(slip.attendanceSummary.leaveDays)],
      ["Late Marks", String(slip.attendanceSummary.lateMarks)],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(7);
  doc.text("This is a computer-generated salary slip and does not require a signature.", 14, y);
  doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, 14, y + 4);

  const filename = `salary-slip-${slip.employee.name.replace(/\s+/g, "-").toLowerCase()}-${slip.payPeriod.end}.pdf`;
  const blob = doc.output("blob");
  downloadBlob(blob, filename);
}

export async function exportAllSalarySlipsPdf(slips: SalarySlipData[]) {
  for (const slip of slips) {
    await exportSalarySlipPdf(slip);
    await new Promise((r) => setTimeout(r, 300));
  }
}
