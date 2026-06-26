"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { daysSinceLastBackup, getLastBackupDate, isBackupOverdue } from "@/lib/backup-reminder";
import { exportFullOrgBackup } from "@/lib/fullDataBackup";

interface BackupReminderBannerProps {
  showForAdmin: boolean;
}

export function BackupReminderBanner({ showForAdmin }: BackupReminderBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    setLastBackup(getLastBackupDate());
    const refresh = () => setLastBackup(getLastBackupDate());
    window.addEventListener("backup-completed", refresh);
    return () => window.removeEventListener("backup-completed", refresh);
  }, []);

  if (!showForAdmin || dismissed || !isBackupOverdue()) return null;

  const days = daysSinceLastBackup();

  async function quickBackup() {
    setExporting(true);
    try {
      await exportFullOrgBackup();
      setLastBackup(getLastBackupDate());
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-3 py-2.5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {lastBackup
              ? `Daily data backup reminder — last export was ${days ?? 1}+ day(s) ago.`
              : "No data backup found on this device. Export all organization data today."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={quickBackup}
            disabled={exporting}
            className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 disabled:opacity-60"
          >
            {exporting ? "Exporting…" : "Export now"}
          </button>
          <Link
            href="/admin/settings"
            className="text-xs font-medium text-amber-800 underline hover:text-amber-950"
          >
            Admin settings
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded p-1 text-amber-700 hover:bg-amber-100"
            aria-label="Dismiss reminder for today"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
