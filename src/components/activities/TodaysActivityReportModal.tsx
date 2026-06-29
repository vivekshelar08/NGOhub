"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, RefreshCw, Share2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ActivityTask } from "@/lib/activities";
import { getTodaysCompletedTasks, shareViaWhatsApp } from "@/lib/activity-share";
import {
  AI_GENERATION_DAILY_LIMIT,
  aiQuotaMessage,
  canGenerateWithAi,
  fieldTodayFingerprint,
  getCachedAiReport,
  getRemainingAiGenerations,
  recordAiGeneration,
  setCachedAiReport,
} from "@/lib/ai-report-quota";
import {
  buildClassicTodayReportFromTasks,
  getTodayReportProviderLabel,
  TodayActivityReportMode,
  TodayActivityReportResult,
} from "@/lib/today-activity-report";
import {
  classicTodayReportInstant,
  fetchTodayActivityReportWithFallback,
} from "@/lib/today-activity-report-client";
import { DEFAULT_ORG_SETTINGS } from "@/lib/orgSettings";

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
  const [loadingAi, setLoadingAi] = useState(false);
  const [report, setReport] = useState<TodayActivityReportResult | null>(null);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [aiAttemptsLeft, setAiAttemptsLeft] = useState(AI_GENERATION_DAILY_LIMIT);

  function resolveTasks(): ActivityTask[] {
    return task ? [task] : getTodaysCompletedTasks(userId);
  }

  function resolveMode(tasks: ActivityTask[]): TodayActivityReportMode {
    return task || tasks.length === 1 ? "single" : "daily";
  }

  function fingerprint(tasks: ActivityTask[], mode: TodayActivityReportMode): string {
    return fieldTodayFingerprint(
      userId,
      mode,
      tasks.map((t) => t.id)
    );
  }

  useEffect(() => {
    const tasks = resolveTasks();
    setAiAttemptsLeft(getRemainingAiGenerations("field-today", userId));

    if (tasks.length === 0) {
      setNotice("No completed activities today.");
      return;
    }

    const mode = resolveMode(tasks);
    const fp = fingerprint(tasks, mode);
    const cached = getCachedAiReport<TodayActivityReportResult>("field-today", fp);

    if (cached && cached.provider !== "template") {
      setReport(cached);
      setNotice("Showing saved AI report (no new generation).");
      return;
    }

    setReport(classicTodayReportInstant(tasks, userName, mode));
    setNotice("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryEnhanceWithAi(tasks: ActivityTask[], mode: TodayActivityReportMode) {
    const fp = fingerprint(tasks, mode);
    const cached = getCachedAiReport<TodayActivityReportResult>("field-today", fp);

    if (cached && cached.provider !== "template") {
      setReport(cached);
      setNotice("Showing saved AI report (no new generation).");
      return;
    }

    if (!canGenerateWithAi("field-today", userId)) {
      setNotice(aiQuotaMessage("field-today", userId));
      return;
    }

    setLoadingAi(true);
    try {
      const { report: next, notice: info } = await fetchTodayActivityReportWithFallback(
        tasks,
        userName,
        mode
      );
      setReport(next);
      setNotice(info ?? "");

      if (next.provider !== "template") {
        recordAiGeneration("field-today", userId);
        setCachedAiReport("field-today", fp, next);
        setAiAttemptsLeft(getRemainingAiGenerations("field-today", userId));
        setNotice(
          info
            ? `${info} ${aiQuotaMessage("field-today", userId)}`
            : aiQuotaMessage("field-today", userId)
        );
      }
    } finally {
      setLoadingAi(false);
    }
  }

  function useClassicOnly() {
    const tasks = resolveTasks();
    if (tasks.length === 0) return;
    setReport(
      buildClassicTodayReportFromTasks(tasks, userName, resolveMode(tasks), DEFAULT_ORG_SETTINGS.orgName)
    );
    setNotice("Using classic WhatsApp report (no AI).");
    setLoadingAi(false);
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

  const tasks = resolveTasks();
  const empty = tasks.length === 0;
  const canTryAi = aiAttemptsLeft > 0;

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
              {userName}
              {report ? ` · ${getTodayReportProviderLabel(report.provider, report.aiModel)}` : ""}
              {loadingAi ? " · generating with AI…" : ""}
              {!empty && ` · ${aiAttemptsLeft}/${AI_GENERATION_DAILY_LIMIT} AI left today`}
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
          {empty && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Complete a field activity today to generate a report.
            </p>
          )}

          {notice && !empty && (
            <p
              className={`mb-3 rounded-lg px-3 py-2 text-sm ${
                report?.usedClassicFallback !== false
                  ? "bg-amber-50 text-amber-900"
                  : "bg-emerald-50 text-emerald-900"
              }`}
            >
              {notice}
            </p>
          )}

          {loadingAi && report && (
            <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generating with AI — classic report kept as backup
            </div>
          )}

          {report && !empty && (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
              {report.message}
            </pre>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-4">
          <Button
            type="button"
            className="gap-1.5"
            disabled={!report || empty}
            onClick={handleWhatsApp}
          >
            <Share2 className="h-4 w-4" />
            Share on WhatsApp
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-1.5"
            disabled={!report || empty}
            onClick={handleCopy}
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy text"}
          </Button>
          {!empty && (
            <>
              <Button
                type="button"
                variant="secondary"
                className="gap-1.5"
                disabled={loadingAi || !canTryAi}
                title={
                  canTryAi
                    ? "Generate with AI (uses 1 of your daily attempts)"
                    : aiQuotaMessage("field-today", userId)
                }
                onClick={() => void tryEnhanceWithAi(tasks, resolveMode(tasks))}
              >
                <RefreshCw className={`h-4 w-4 ${loadingAi ? "animate-spin" : ""}`} />
                {canTryAi ? "Generate with AI" : "AI limit reached"}
              </Button>
              <Button type="button" variant="secondary" onClick={useClassicOnly}>
                Classic report
              </Button>
            </>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
