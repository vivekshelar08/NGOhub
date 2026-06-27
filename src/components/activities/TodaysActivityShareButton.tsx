"use client";

import { useEffect, useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ActivityTask } from "@/lib/activities";
import {
  buildSingleTaskShareMessage,
  buildTodaysActivityShareMessage,
  getTodaysCompletedTasks,
  shareViaWhatsApp,
} from "@/lib/activity-share";
import { DEFAULT_ORG_SETTINGS } from "@/lib/orgSettings";

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

  function handleShare() {
    const message = task
      ? buildSingleTaskShareMessage(task, userName, DEFAULT_ORG_SETTINGS.orgName)
      : buildTodaysActivityShareMessage(todaysTasks, userName, DEFAULT_ORG_SETTINGS.orgName);
    shareViaWhatsApp(message);
  }

  if (compact) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={`gap-1.5 ${className ?? ""}`}
        onClick={handleShare}
      >
        <Share2 className="h-4 w-4" />
        Share on WhatsApp
      </Button>
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
        onClick={handleShare}
      >
        <Share2 className="h-4 w-4" />
        Share today&apos;s work
        {count > 0 && !task ? ` (${count})` : ""}
      </Button>
      {disabled && (
        <p className="mt-1 text-xs text-slate-500">
          Complete a field activity today to generate a share message.
        </p>
      )}
    </div>
  );
}
