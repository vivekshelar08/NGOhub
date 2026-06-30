"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, Receipt, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import {
  CONTRIBUTION_RECIPIENT_LABELS,
  DailyContributionSummary,
  formatContributionInr,
} from "@/lib/community-contribution";
import { localDateKey } from "@/lib/hr-utils";

interface CommunityContributionDaySummaryProps {
  projectId?: string;
  /** When true, only entries recorded by the current user today. */
  mineOnly?: boolean;
  className?: string;
}

function buildReportText(summary: DailyContributionSummary, projectTitle?: string): string {
  const lines = [
    `Community contribution tally — ${summary.date}`,
    projectTitle ? `Project: ${projectTitle}` : "",
    "",
    `Collected: ${summary.collectedCount} entries · ${formatContributionInr(summary.collectedAmount)}`,
    `Pending: ${summary.pendingCount} entries · ${formatContributionInr(summary.pendingAmount)}`,
    `Total registered today: ${summary.totalEntries}`,
  ].filter(Boolean);

  if (summary.byService.length > 0) {
    lines.push("", "By service:");
    for (const row of summary.byService) {
      lines.push(
        `• ${row.serviceName}: collected ${formatContributionInr(row.collectedAmount)} (${row.collectedCount}), pending ${formatContributionInr(row.pendingAmount)} (${row.pendingCount})`
      );
    }
  }

  if (summary.byRecipient.length > 0) {
    lines.push("", "By recipient:");
    for (const row of summary.byRecipient) {
      const label =
        row.recipientType === "PARTNER"
          ? row.partnerName || CONTRIBUTION_RECIPIENT_LABELS.PARTNER
          : CONTRIBUTION_RECIPIENT_LABELS.NGO;
      lines.push(
        `• ${label}: collected ${formatContributionInr(row.collectedAmount)}, pending ${formatContributionInr(row.pendingAmount)}`
      );
    }
  }

  return lines.join("\n");
}

export function CommunityContributionDaySummary({
  projectId,
  mineOnly = false,
  className,
}: CommunityContributionDaySummaryProps) {
  const [summary, setSummary] = useState<DailyContributionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dateKey, setDateKey] = useState(localDateKey());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: dateKey });
      if (projectId) params.set("projectId", projectId);
      if (mineOnly) params.set("mine", "1");
      const res = await fetch(`/api/community-contributions/summary?${params}`);
      const data = await res.json();
      if (res.ok) setSummary(data.summary);
      else setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [dateKey, projectId, mineOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCopy() {
    if (!summary) return;
    await navigator.clipboard.writeText(buildReportText(summary));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-2">
          <Receipt className="mt-0.5 h-5 w-5 text-brand-teal" />
          <div>
            <CardTitle className="text-base">Today&apos;s community contribution tally</CardTitle>
            <p className="mt-0.5 text-xs text-slate-500">
              Amounts collected from beneficiaries today — use for end-of-day reporting.
              {mineOnly ? " Showing your entries only." : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-4 pb-4 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading tally…
        </div>
      )}

      {!loading && summary && summary.totalEntries === 0 && (
        <p className="px-4 pb-4 text-sm text-slate-500">
          No community contributions recorded for this date
          {projectId ? " on this project" : ""}.
        </p>
      )}

      {!loading && summary && summary.totalEntries > 0 && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-emerald-50 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                Collected
              </p>
              <p className="text-lg font-semibold text-emerald-900">
                {formatContributionInr(summary.collectedAmount)}
              </p>
              <p className="text-xs text-emerald-700">{summary.collectedCount} entries</p>
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Pending</p>
              <p className="text-lg font-semibold text-amber-900">
                {formatContributionInr(summary.pendingAmount)}
              </p>
              <p className="text-xs text-amber-700">{summary.pendingCount} entries</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Total</p>
              <p className="text-lg font-semibold text-slate-900">{summary.totalEntries}</p>
              <p className="text-xs text-slate-500">entries today</p>
            </div>
          </div>

          <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={handleCopy}>
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy tally for report"}
          </Button>
          {projectId && (
            <a
              href={`/api/community-contributions/export?projectId=${encodeURIComponent(projectId)}&from=${dateKey}&to=${dateKey}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
