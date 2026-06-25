"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AchievementFilters } from "@/lib/achievements";
import { ProjectProposal } from "@/lib/projects";
import {
  exportAchievementsReportExcel,
  exportAchievementsReportPdf,
  exportAchievementsReportWord,
} from "@/lib/achievementExport";

interface AchievementExportActionsProps {
  projects: ProjectProposal[];
  filters: AchievementFilters;
  disabled?: boolean;
}

export function AchievementExportActions({
  projects,
  filters,
  disabled = false,
}: AchievementExportActionsProps) {
  const [busy, setBusy] = useState<"word" | "pdf" | "excel" | null>(null);

  async function run(format: "word" | "pdf" | "excel") {
    setBusy(format);
    try {
      if (format === "word") {
        await exportAchievementsReportWord(projects, filters);
      } else if (format === "pdf") {
        await exportAchievementsReportPdf(projects, filters);
      } else {
        await exportAchievementsReportExcel(projects, filters);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        disabled={disabled || Boolean(busy)}
        onClick={() => run("excel")}
      >
        <FileSpreadsheet className="h-4 w-4" />
        {busy === "excel" ? "Exporting…" : "Export Excel"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        disabled={disabled || Boolean(busy)}
        onClick={() => run("word")}
      >
        <FileText className="h-4 w-4" />
        {busy === "word" ? "Exporting…" : "Export Word"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        disabled={disabled || Boolean(busy)}
        onClick={() => run("pdf")}
      >
        <Download className="h-4 w-4" />
        {busy === "pdf" ? "Exporting…" : "Export PDF"}
      </Button>
    </div>
  );
}
