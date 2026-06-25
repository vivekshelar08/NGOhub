"use client";

import { useState } from "react";
import { Download, FileText, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProjectProposal } from "@/lib/projects";
import { exportProposalPdf, exportProposalWord, shareProposal } from "@/lib/proposalExport";

interface ProposalExportActionsProps {
  project: ProjectProposal;
  shareUrl: string;
  size?: "sm" | "md";
  className?: string;
}

export function ProposalExportActions({
  project,
  shareUrl,
  size = "sm",
  className,
}: ProposalExportActionsProps) {
  const [busy, setBusy] = useState<"word" | "pdf" | "share" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: "word" | "pdf" | "share", fn: () => Promise<void>) {
    setMessage(null);
    setBusy(action);
    try {
      await fn();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size={size}
          className="gap-1.5"
          disabled={Boolean(busy)}
          onClick={() => run("word", async () => exportProposalWord(project))}
        >
          <FileText className="h-4 w-4" />
          {busy === "word" ? "Exporting…" : "Word (.docx)"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size={size}
          className="gap-1.5"
          disabled={Boolean(busy)}
          onClick={() => run("pdf", async () => exportProposalPdf(project))}
        >
          <Download className="h-4 w-4" />
          {busy === "pdf" ? "Exporting…" : "PDF"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size={size}
          className="gap-1.5"
          disabled={Boolean(busy)}
          onClick={() =>
            run("share", async () => {
              const result = await shareProposal(project, shareUrl);
              setMessage(result);
            })
          }
        >
          <Share2 className="h-4 w-4" />
          {busy === "share" ? "Sharing…" : "Share"}
        </Button>
      </div>
      {message && <p className="mt-2 text-xs text-brand-teal dark:text-brand-teal-light">{message}</p>}
    </div>
  );
}
