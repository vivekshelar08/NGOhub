"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, Share2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ActivityTask } from "@/lib/activities";
import {
  getTodaysCompletedTasks,
  shareViaWhatsApp,
} from "@/lib/activity-share";
import {
  buildTemplateFromSummaries,
  getTodayReportProviderLabel,
  serializeTaskForReport,
  TodayActivityReportResult,
} from "@/lib/today-activity-report";
import { DEFAULT_ORG_SETTINGS } from "@/lib/orgSettings";
import { fetchJson } from "@/lib/fetch-json";

interface TodaysActivityReportModalProps {
  userId: string;
  userName: string;
  task?: ActivityTask;
  onClose: () => void;
}

export function TodaysActivityReportModal({
  userId,
  userName,
  task,
  onClose,
}: TodaysActivityReportModalProps) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<TodayActivityReportResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void generateReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateReport() {
    setLoading(true);
    setError("");
    try {
      const tasks = task ? [task] : getTodaysCompletedTasks(userId);
      if (tasks.length === 0) {
        setError("No completed activities today.");
        setLoading(false);
        return;
      }

      const res = await fetchJson<TodayActivityReportResult>("/api/reports/today-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName,
          orgName: DEFAULT_ORG_SETTINGS.orgName,
          mode: task ? "single" : "daily",
          tasks: tasks.map(serializeTaskForReport),
        }),
      });
      setReport(res);
    } catch (err) {
      const tasks = task ? [task] : getTodaysCompletedTasks(userId);
      if (tasks.length > 0) {
        const fallback = buildTemplateFromSummaries({
          userName,
          orgName: DEFAULT_ORG_SETTINGS.orgName,
          mode: task ? "single" : "daily",
          tasks: tasks.map(serializeTaskForReport),
        });
        setReport({
          message: fallback,
          provider: "template",
          generatedAt: new Date().toISOString(),
          mode: task ? "single" : "daily",
        });
        setError(
          err instanceof Error
            ? `${err.message} — showing offline template instead.`
            : "API unavailable — showing offline template."
        );
      } else {
        setError(err instanceof Error ? err.message : "Failed to generate report");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!report) return;
    await navigator.clipboard.writeText(report.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp() {
    if (!report) return;
    shareViaWhatsApp(report.message);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-teal" />
              <h2 className="text-lg font-semibold text-slate-900">
                {task ? "Activity report" : "Today's field report"}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Personalized report for {userName}
              {report ? ` · ${getTodayReportProviderLabel(report.provider, report.aiModel)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-brand-teal" />
              <p className="text-sm">Writing your personalized field report…</p>
            </div>
          )}

          {error && !loading && (
            <div className="space-y-3">
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => generateReport()}>
                Try again
              </Button>
            </div>
          )}

          {report && !loading && (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
              {report.message}
            </pre>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-4">
          <Button
            type="button"
            className="gap-1.5"
            disabled={!report || loading}
            onClick={handleWhatsApp}
          >
            <Share2 className="h-4 w-4" />
            Share on WhatsApp
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-1.5"
            disabled={!report || loading}
            onClick={handleCopy}
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy text"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
