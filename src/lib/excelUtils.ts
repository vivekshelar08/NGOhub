import * as XLSX from "xlsx";

export interface ExcelSheet {
  name: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

function cellValue(v: string | number | null | undefined): string | number {
  if (v == null) return "";
  return v;
}

export function buildWorkbook(sheets: ExcelSheet[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const data = [sheet.headers, ...sheet.rows.map((row) => row.map(cellValue))];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const safeName = sheet.name.slice(0, 31).replace(/[\\/?*[\]]/g, "-") || "Sheet";
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportSheetsToExcel(sheets: ExcelSheet[], filename: string) {
  downloadWorkbook(buildWorkbook(sheets), filename);
}

export function safeExportFilename(prefix: string, suffix?: string) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = suffix
    ? suffix.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 40)
    : "";
  return slug ? `${prefix}-${date}-${slug}` : `${prefix}-${date}`;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  filename: string
) {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
