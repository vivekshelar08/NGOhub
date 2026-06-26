"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_STATUS_LABELS,
  daysInMonth,
  formatDateKey,
  formatTimeKolkata,
  localDateKey,
} from "@/lib/hr-utils";

interface AttendanceRecord {
  id: string;
  date: string;
  punchIn: string | null;
  punchOut: string | null;
  status: string;
  lateMinutes?: number;
  isLateMark?: boolean;
}

interface MyAttendancePanelProps {
  userId: string;
  onFlash?: (msg: string, isError?: boolean) => void;
}

export function MyAttendancePanel({ userId, onFlash }: MyAttendancePanelProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCorrection, setShowCorrection] = useState<string | null>(null);
  const [correctionForm, setCorrectionForm] = useState({
    date: "",
    punchIn: "",
    punchOut: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/attendance?month=${monthKey}`);
      if (!res.ok) return;
      const data = await res.json();
      setRecords(data.records ?? []);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const recordByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of records) {
      const key = r.date.slice(0, 10);
      map.set(key, r);
    }
    return map;
  }, [records]);

  const dayKeys = daysInMonth(year, month);
  const todayKey = localDateKey();

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  }

  function openCorrection(dateKey: string, record?: AttendanceRecord) {
    setShowCorrection(dateKey);
    setCorrectionForm({
      date: dateKey,
      punchIn: record?.punchIn
        ? new Date(record.punchIn).toLocaleTimeString("en-GB", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "",
      punchOut: record?.punchOut
        ? new Date(record.punchOut).toLocaleTimeString("en-GB", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "",
      reason: "",
    });
  }

  async function submitCorrection() {
    if (!correctionForm.reason.trim()) {
      onFlash?.("Please describe the error you want corrected.", true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/hr/attendance/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: correctionForm.date,
          requestedPunchIn: correctionForm.punchIn || undefined,
          requestedPunchOut: correctionForm.punchOut || undefined,
          reason: correctionForm.reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onFlash?.(data.error ?? "Could not submit request", true);
        return;
      }
      onFlash?.("Correction request sent to HR / manager for review.");
      setShowCorrection(null);
    } finally {
      setSubmitting(false);
    }
  }

  const monthLabel = formatDateKey(`${monthKey}-01`, "en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">My attendance</h2>
            <p className="text-sm text-slate-500">
              Times shown in IST (Kolkata, UTC+5:30). Raise a correction request if anything is wrong.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[10rem] text-center text-sm font-medium text-slate-800">
              {monthLabel}
            </span>
            <Button type="button" variant="secondary" size="sm" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading attendance…</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Day</th>
                  <th className="px-3 py-2.5 font-medium">Check in</th>
                  <th className="px-3 py-2.5 font-medium">Check out</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {dayKeys.map((dateKey) => {
                  const record = recordByDate.get(dateKey);
                  const dayName = formatDateKey(dateKey, "en-IN", { weekday: "short" });
                  const isToday = dateKey === todayKey;
                  const isFuture = dateKey > todayKey;
                  return (
                    <tr
                      key={dateKey}
                      className={cn(
                        "border-b border-slate-100",
                        isToday && "bg-brand-mist/40"
                      )}
                    >
                      <td className="px-3 py-2.5 font-medium text-slate-800">
                        {formatDateKey(dateKey, "en-IN", { day: "2-digit", month: "short" })}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{dayName}</td>
                      <td className="px-3 py-2.5">{formatTimeKolkata(record?.punchIn)}</td>
                      <td className="px-3 py-2.5">{formatTimeKolkata(record?.punchOut)}</td>
                      <td className="px-3 py-2.5">
                        {record ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              record.isLateMark
                                ? "bg-amber-100 text-amber-800"
                                : "bg-brand-mist text-brand-teal-dark"
                            )}
                          >
                            {ATTENDANCE_STATUS_LABELS[record.status] ?? record.status}
                            {record.isLateMark && record.lateMinutes
                              ? ` (+${record.lateMinutes}m)`
                              : ""}
                          </span>
                        ) : isFuture ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <span className="text-slate-400">No record</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {!isFuture && (
                          <button
                            type="button"
                            onClick={() => openCorrection(dateKey, record)}
                            className="text-xs font-medium text-brand-teal hover:text-brand-teal-dark"
                          >
                            Request edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showCorrection && (
        <Card className="p-5">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900">Request attendance correction</h3>
                <p className="text-sm text-slate-500">
                  For {formatDateKey(showCorrection, "en-IN", { dateStyle: "long" })} — HR or your
                  manager will review and update.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Correct check-in time (IST)</Label>
                  <Input
                    type="time"
                    className="mt-1.5"
                    value={correctionForm.punchIn}
                    onChange={(e) =>
                      setCorrectionForm({ ...correctionForm, punchIn: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Correct check-out time (IST)</Label>
                  <Input
                    type="time"
                    className="mt-1.5"
                    value={correctionForm.punchOut}
                    onChange={(e) =>
                      setCorrectionForm({ ...correctionForm, punchOut: e.target.value })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>What is wrong? *</Label>
                  <textarea
                    className="input-brand mt-1.5 resize-y"
                    rows={3}
                    value={correctionForm.reason}
                    onChange={(e) =>
                      setCorrectionForm({ ...correctionForm, reason: e.target.value })
                    }
                    placeholder="e.g. Forgot to punch out, was on field visit…"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={submitCorrection} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit to HR"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCorrection(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
