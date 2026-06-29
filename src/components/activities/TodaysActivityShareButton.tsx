"use client";

import { useEffect, useMemo, useState } from "react";
import { Share2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ActivityTask } from "@/lib/activities";
import {
  getTodaysCompletedTasks,
  shareViaWhatsApp,
} from "@/lib/activity-share";
import { buildClassicTodayReportFromTasks } from "@/lib/today-activity-report";
import { DEFAULT_ORG_SETTINGS } from "@/lib/orgSettings";
import { TodaysActivityReportModal } from "@/components/activities/TodaysActivityReportModal";

interface TodaysActivityShareButtonProps {
  userId: string;
  userName: string;
  /** Share one activity only (e.g. right after completion). */
  task?: ActivityTask;
  compact?: boolean;
  className?: string;
}

export function TodaysActivityShareButton({
  userId,
  userName,
  task,
  compact,
  className,
}: TodaysActivityShareButtonProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    function onUpdate() {
      setRefreshKey((k) => k + 1);
    }
    window.addEventListener("activities-updated", onUpdate);
    return () => window.removeEventListener("activities-updated", onUpdate);
  }, []);

  const todaysTasks = useMemo(
    () => getTodaysCompletedTasks(userId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, refreshKey]
  );
  const count = task ? 1 : todaysTasks.length;
  const disabled = !task && todaysTasks.length === 0;

  function quickClassicShare() {
    const tasks = task ? [task] : todaysTasks;
    if (tasks.length === 0) return;
    const mode = task || tasks.length === 1 ? "single" : "daily";
    const { message } = buildClassicTodayReportFromTasks(
      tasks,
      userName,
      mode,
      DEFAULT_ORG_SETTINGS.orgName
    );
    shareViaWhatsApp(message);
  }

  if (compact) {
    return (
      <>
        <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowReport(true)}
          >
            <Sparkles className="h-4 w-4" />
            AI report
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={quickClassicShare}
          >
            <Zap className="h-4 w-4" />
            Quick share
          </Button>
        </div>
        {showReport && (
          <TodaysActivityReportModal
            userId={userId}
            userName={userName}
            task={task}
            onClose={() => setShowReport(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={disabled}
          onClick={() => setShowReport(true)}
        >
          <Share2 className="h-4 w-4" />
          Write today&apos;s report
          {count > 0 && !task ? ` (${count})` : ""}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={disabled}
          onClick={quickClassicShare}
          title="Instant classic WhatsApp message — no AI, works offline"
        >
          <Zap className="h-4 w-4" />
          Quick share
        </Button>
      </div>
      {disabled && (
        <p className="mt-1 text-xs text-slate-500">
          Complete a field activity today to share your work.
        </p>
      )}
      {!disabled && (
        <p className="mt-1 text-xs text-slate-500">
          <strong>Quick share</strong> uses the classic report (always works).{" "}
          <strong>Write today&apos;s report</strong> opens classic report instantly; tap{" "}
          <strong>Generate with AI</strong> when you want AI (max 2/day).
        </p>
      )}
      {showReport && (
        <TodaysActivityReportModal
          userId={userId}
          userName={userName}
          task={task}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
