"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, MapPin, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimeKolkata, localDateKey } from "@/lib/hr-utils";

interface DaySummary {
  date: string;
  onLeave: boolean;
  attendance: {
    punchIn: string | null;
    punchOut: string | null;
    status: string;
  } | null;
  tasks: { assigned: number; active: number; completed: number; total: number };
  fieldVisits: number;
}

export function FieldDayStatusStrip({ className }: { className?: string }) {
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      const res = await fetch("/api/hr/attendance/day-summary", { signal: controller.signal });
      window.clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch {
      /* non-blocking — strip hidden on failure */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onUpdate = () => void load();
    window.addEventListener("activities-updated", onUpdate);
    return () => window.removeEventListener("activities-updated", onUpdate);
  }, [load]);

  if (loading || !summary) return null;

  if (summary.onLeave) {
    return (
      <div className={cn("rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900", className)}>
        <strong>On leave today</strong> — field tasks should be reassigned if you are unavailable.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-lg border border-brand-teal/20 bg-brand-mist/40 px-4 py-3 text-sm", className)}>
      <span className="font-medium text-brand-teal-dark">{localDateKey()}</span>
      <span className="inline-flex items-center gap-1 text-slate-700">
        <Clock className="h-3.5 w-3.5" />
        In {summary.attendance?.punchIn ? formatTimeKolkata(summary.attendance.punchIn) : "—"}
        {" · "}
        Out {summary.attendance?.punchOut ? formatTimeKolkata(summary.attendance.punchOut) : "—"}
      </span>
      <span className="text-slate-600">
        Tasks: {summary.tasks.assigned} pending · {summary.tasks.active} active · {summary.tasks.completed} done
      </span>
      {summary.fieldVisits > 0 && (
        <span className="inline-flex items-center gap-1 text-slate-600">
          <MapPin className="h-3.5 w-3.5" />
          {summary.fieldVisits} field visit{summary.fieldVisits === 1 ? "" : "s"}
        </span>
      )}
      <button
        type="button"
        onClick={() => void load()}
        className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand-teal hover:text-brand-teal-dark"
      >
        <RefreshCw className="h-3 w-3" />
        Refresh
      </button>
    </div>
  );
}
