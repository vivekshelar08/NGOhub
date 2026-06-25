"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface TodayRecord {
  punchIn: string | null;
  punchOut: string | null;
  isLateMark?: boolean;
  lateMinutes?: number;
}

interface AttendancePunchWidgetProps {
  userName?: string;
  variant?: "dashboard" | "compact";
  className?: string;
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AttendancePunchWidget({
  userName,
  variant = "dashboard",
  className,
}: AttendancePunchWidgetProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [todayRecord, setTodayRecord] = useState<TodayRecord | null>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const loadToday = useCallback(async () => {
    const res = await fetch(`/api/hr/attendance?month=${currentMonth}`);
    if (!res.ok) return;
    const data = await res.json();
    setTodayRecord(data.todayRecord ?? null);
  }, [currentMonth]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  async function handlePunch(action: "in" | "out") {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/hr/attendance/punch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error ?? "Punch failed");
      setIsError(true);
      return;
    }
    const data = await res.json();
    if (data.lateInfo) {
      setMessage(data.lateInfo.message);
      setIsError(true);
    } else {
      setMessage(action === "in" ? "Punched in successfully" : "Punched out successfully");
      setIsError(false);
    }
    loadToday();
    setTimeout(() => setMessage(""), 4000);
  }

  const punchedIn = !!todayRecord?.punchIn;
  const punchedOut = !!todayRecord?.punchOut;

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-wrap items-center gap-3", className)}>
        <Button onClick={() => handlePunch("in")} disabled={loading || punchedIn} size="sm">
          Punch In
        </Button>
        <Button
          variant="secondary"
          onClick={() => handlePunch("out")}
          disabled={loading || !punchedIn || punchedOut}
          size="sm"
        >
          Punch Out
        </Button>
        <span className="text-sm text-slate-500">
          In {formatTime(todayRecord?.punchIn ?? null)} · Out {formatTime(todayRecord?.punchOut ?? null)}
        </span>
      </div>
    );
  }

  return (
    <Card className={cn("mb-6 border-brand-teal/25 bg-gradient-to-r from-brand-mist to-white", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-red text-white">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Attendance — Punch In / Out</CardTitle>
            <p className="mt-0.5 text-sm text-slate-600">
              {userName ? `Good day, ${userName}. ` : ""}
              Record your attendance for today.
            </p>
            {message && (
              <p className={cn("mt-2 text-sm", isError ? "text-amber-700" : "text-brand-teal-dark")}>
                {message}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="rounded-lg bg-white/80 px-4 py-2.5 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Punch In</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatTime(todayRecord?.punchIn ?? null)}
            </p>
          </div>
          <div className="rounded-lg bg-white/80 px-4 py-2.5 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">Punch Out</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatTime(todayRecord?.punchOut ?? null)}
            </p>
          </div>
          {todayRecord?.isLateMark && (
            <p className="text-sm font-medium text-amber-700">
              Late — {todayRecord.lateMinutes ?? 0} min
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={() => handlePunch("in")} disabled={loading || punchedIn} size="lg">
              Punch In
            </Button>
            <Button
              variant="secondary"
              onClick={() => handlePunch("out")}
              disabled={loading || !punchedIn || punchedOut}
              size="lg"
            >
              Punch Out
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
