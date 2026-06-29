"use client";

import { useEffect, useMemo, useState } from "react";
import { Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ActivityTask } from "@/lib/activities";
import { getTodaysCompletedTasks } from "@/lib/activity-share";
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

  if (compact) {
    return (
      <>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={`gap-1.5 ${className ?? ""}`}
          onClick={() => setShowReport(true)}
        >
          <Sparkles className="h-4 w-4" />
          AI field report
        </Button>
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
      {disabled && (
        <p className="mt-1 text-xs text-slate-500">
          Complete a field activity today to generate a personalized AI report.
        </p>
      )}
      {!disabled && (
        <p className="mt-1 text-xs text-slate-500">
          AI writes a personalized summary you can share on WhatsApp.
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
