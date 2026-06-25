"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProjectProposal } from "@/lib/projects";
import { exportCombinedSdgReportPdf, exportCombinedSdgReportWord } from "@/lib/proposalExport";

interface CombinedSdgExportActionsProps {
  projects: ProjectProposal[];
  className?: string;
}

export function CombinedSdgExportActions({ projects, className }: CombinedSdgExportActionsProps) {
  const [busy, setBusy] = useState<"word" | "pdf" | null>(null);
  const year = new Date().getFullYear();

  async function run(format: "word" | "pdf") {
    setBusy(format);
    try {
      if (format === "word") {
        await exportCombinedSdgReportWord(projects, year);
      } else {
        await exportCombinedSdgReportPdf(projects, year);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Combined SDG annual report
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={Boolean(busy)}
          onClick={() => run("word")}
        >
          <FileText className="h-4 w-4" />
          {busy === "word" ? "Exporting…" : `All Projects Word (${year})`}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={Boolean(busy)}
          onClick={() => run("pdf")}
        >
          <Download className="h-4 w-4" />
          {busy === "pdf" ? "Exporting…" : `All Projects PDF (${year})`}
        </Button>
      </div>
    </div>
  );
}
