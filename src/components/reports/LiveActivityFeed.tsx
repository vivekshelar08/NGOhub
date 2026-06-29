"use client";

import { ActivityLiveEvent } from "@/lib/analytics";
import { TASK_STATUS_LABELS, WORK_TYPE_LABELS } from "@/lib/activities";
import { cn } from "@/lib/utils";
import { Activity, CheckCircle2, Clock, XCircle } from "lucide-react";

const STATUS_ICON: Record<string, typeof Activity> = {
  completed: CheckCircle2,
  active: Activity,
  assigned: Clock,
  canceled: XCircle,
  rescheduled: Clock,
};

const STATUS_COLOR: Record<string, string> = {
  completed: "text-emerald-600 bg-emerald-50",
  active: "text-blue-600 bg-blue-50",
  assigned: "text-amber-600 bg-amber-50",
  canceled: "text-red-600 bg-red-50",
  rescheduled: "text-slate-600 bg-slate-100",
};

interface LiveActivityFeedProps {
  events: ActivityLiveEvent[];
  className?: string;
}

export function LiveActivityFeed({ events, className }: LiveActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className={cn("flex h-48 items-center justify-center text-sm text-slate-500", className)}>
        No recent field activities for current filters
      </div>
    );
  }

  return (
    <ul className={cn("divide-y divide-slate-100", className)}>
      {events.map((event) => {
        const Icon = STATUS_ICON[event.status] ?? Activity;
        const colorClass = STATUS_COLOR[event.status] ?? "text-slate-600 bg-slate-100";
        const dateLabel = (event.completedAt ?? event.scheduledDate)?.slice(0, 10) ?? "—";

        return (
          <li key={event.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                colorClass
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{event.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {event.projectTitle} · {WORK_TYPE_LABELS[event.workType as keyof typeof WORK_TYPE_LABELS] ?? event.workType}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className={cn("rounded-full px-2 py-0.5 font-medium", colorClass)}>
                  {TASK_STATUS_LABELS[event.status as keyof typeof TASK_STATUS_LABELS] ?? event.status}
                </span>
                <span className="text-slate-400">{dateLabel}</span>
                {event.beneficiaryCount > 0 && (
                  <span className="text-slate-500">{event.beneficiaryCount} reached</span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
