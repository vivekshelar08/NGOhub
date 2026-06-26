"use client";

import { useState } from "react";
import { Database, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { daysSinceLastBackup, getLastBackupDate } from "@/lib/backup-reminder";
import { exportFullOrgBackup } from "@/lib/fullDataBackup";

export function DataBackupPanel() {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lastBackup = getLastBackupDate();
  const daysSince = daysSinceLastBackup();

  async function handleBackup() {
    setExporting(true);
    setMessage(null);
    try {
      await exportFullOrgBackup();
      setMessage("Full backup downloaded. Store this file securely offline.");
      window.dispatchEvent(new Event("backup-completed"));
    } catch {
      setMessage("Backup failed. Check your connection and try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5 text-brand-teal" />
            Full data backup
          </CardTitle>
          <CardDescription className="mt-1">
            Export all beneficiaries, field activities, projects, and calendar data to Excel.
            Run daily and keep copies offline — this data is sensitive and critical.
          </CardDescription>
          <p className="mt-2 text-xs text-slate-500">
            {lastBackup
              ? `Last backup: ${lastBackup}${daysSince != null && daysSince > 0 ? ` (${daysSince} day${daysSince === 1 ? "" : "s"} ago)` : " (today)"}`
              : "No backup recorded on this device yet."}
          </p>
        </div>
        <Button
          type="button"
          className="gap-1.5 shrink-0"
          disabled={exporting}
          onClick={handleBackup}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {exporting ? "Preparing backup…" : "Download full backup"}
        </Button>
      </div>
      {message && <p className="mt-3 text-sm text-brand-teal-dark">{message}</p>}
    </Card>
  );
}
