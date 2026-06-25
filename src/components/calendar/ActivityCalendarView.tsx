"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import {
  CalendarEvent,
  formatMonthYear,
  getMonthRange,
  HOLIDAY_TYPE_COLORS,
  HOLIDAY_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_STYLES,
  WORK_TYPE_LABELS,
} from "@/lib/calendar-types";
import {
  groupEventsByDate,
  getVisibleTasks,
  TASK_STATUS_CALENDAR_STYLES,
  TASK_STATUS_LABELS,
  tasksInDateRange,
  WORK_TYPE_LABELS as FIELD_WORK_TYPE_LABELS,
} from "@/lib/calendar-utils";
import { localDateKey, formatDateKey } from "@/lib/hr-utils";
import { cn } from "@/lib/utils";
import { CalendarWorkType, Role } from "@/generated/prisma/enums";
import {
  calendarEventToMeeting,
  exportCalendarDayExcel,
  exportMeetingExcel,
} from "@/lib/meetingExport";
import { exportActivityTaskExcel } from "@/lib/activityExport";
import { loadActivityTasks } from "@/lib/activities";

interface ActivityRequest {
  id: string;
  title: string;
  description: string | null;
  workType: CalendarWorkType;
  scheduledDate: string;
  endDate: string | null;
  status: string;
  requestedByName: string;
  department: string | null;
  reviewNotes: string | null;
}

interface ActivityCalendarViewProps {
  userId: string;
  userRole: Role;
  canViewAll: boolean;
  canRequest: boolean;
  canApprove: boolean;
  /** Hide page header when embedded in Activities hub */
  embedded?: boolean;
  /** Switch to task view and open a task (replaces external link) */
  onOpenTask?: (taskId: string) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const KIND_CELL_STYLES: Record<CalendarEvent["kind"], string> = {
  task: "bg-brand-teal/15 text-brand-teal-dark border-brand-teal/25",
  request: "bg-teal-500/15 text-teal-800 border-teal-200",
  holiday: "bg-amber-500/15 text-amber-800 border-amber-200",
  leave: "bg-blue-500/15 text-blue-800 border-blue-200",
};

const KIND_LEGEND = [
  { kind: "task" as const, label: "Assigned Activities", color: "bg-brand-mist" },
  { kind: "request" as const, label: "Activity Requests", color: "bg-teal-500" },
  { kind: "holiday" as const, label: "Holidays & Festivals", color: "bg-amber-400" },
  { kind: "leave" as const, label: "Approved Leave", color: "bg-blue-400" },
];

function sortDayEvents(events: CalendarEvent[]) {
  const order: Record<CalendarEvent["kind"], number> = {
    task: 0,
    request: 1,
    holiday: 2,
    leave: 3,
  };
  return [...events].sort((a, b) => order[a.kind] - order[b.kind] || a.title.localeCompare(b.title));
}

export function ActivityCalendarView({
  userId,
  userRole,
  canViewAll,
  canRequest,
  canApprove,
  embedded = false,
  onOpenTask,
}: ActivityCalendarViewProps) {
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [calendarReady, setCalendarReady] = useState(false);
  const [apiEvents, setApiEvents] = useState<CalendarEvent[]>([]);
  const [localTasksVersion, setLocalTasksVersion] = useState(0);
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [pendingRequests, setPendingRequests] = useState<ActivityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [flash, setFlash] = useState<{ msg: string; error?: boolean } | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    workType: "PROJECT" as CalendarWorkType,
    scheduledDate: "",
    endDate: "",
  });

  const monthRange = useMemo(() => getMonthRange(year, month), [year, month]);

  const showFlash = useCallback((msg: string, isError = false) => {
    setFlash({ msg, error: isError });
    setTimeout(() => setFlash(null), 3500);
  }, []);

  useEffect(() => {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(localDateKey(today));
    setCalendarReady(true);
  }, []);

  useEffect(() => {
    fetch("/api/users/assignable")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((data) => {
        const map = new Map<string, string>();
        for (const u of data.users ?? []) {
          map.set(u.id, u.name);
        }
        setUserNames(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const refresh = () => setLocalTasksVersion((v) => v + 1);
    window.addEventListener("activities-updated", refresh);
    window.addEventListener("projects-updated", refresh);
    return () => {
      window.removeEventListener("activities-updated", refresh);
      window.removeEventListener("projects-updated", refresh);
    };
  }, []);

  const loadCalendar = useCallback(async () => {
    if (!calendarReady || year < 1970) return;

    setLoading(true);
    const [eventsRes, pendingRes] = await Promise.all([
      fetch(`/api/calendar/events?from=${monthRange.from}&to=${monthRange.to}`),
      canApprove
        ? fetch("/api/calendar/requests?status=PENDING&all=1")
        : Promise.resolve(null),
    ]);

    if (eventsRes.ok) {
      const data = await eventsRes.json();
      setApiEvents(data.events ?? []);
    } else {
      setApiEvents([]);
      showFlash("Could not load calendar events. Please try again.", true);
    }

    if (pendingRes?.ok) {
      const data = await pendingRes.json();
      setPendingRequests(data.requests ?? []);
    }

    setLoading(false);
  }, [calendarReady, year, monthRange.from, monthRange.to, canApprove, showFlash]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const taskEvents = useMemo(() => {
    void localTasksVersion;
    const visible = getVisibleTasks(userId, userRole, canViewAll).filter(
      (t) => t.status !== "canceled"
    );
    return tasksInDateRange(visible, monthRange.from, monthRange.to, userNames);
  }, [localTasksVersion, monthRange.from, monthRange.to, userNames, userId, userRole, canViewAll]);

  const events = useMemo(
    () => [...taskEvents, ...apiEvents],
    [taskEvents, apiEvents]
  );

  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);

  const selectedEvents = sortDayEvents(eventsByDate.get(selectedDate) ?? []);

  const monthActivityDates = useMemo(() => {
    const dates = [...eventsByDate.entries()]
      .filter(([, dayEvents]) => dayEvents.some((e) => e.kind === "task" || e.kind === "request"))
      .sort(([a], [b]) => a.localeCompare(b));
    return dates;
  }, [eventsByDate]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells: Array<{ date: string | null; day: number | null }> = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push({ date: null, day: null });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ date, day });
    }

    return cells;
  }, [year, month]);

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(year, month + delta, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth());
  }

  function goToToday() {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDate(localDateKey(now));
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/calendar/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        scheduledDate: form.scheduledDate || selectedDate,
        endDate: form.endDate || undefined,
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      showFlash(data.error ?? "Failed to submit request", true);
      return;
    }

    showFlash("Activity request submitted for approval");
    setForm({ title: "", description: "", workType: "PROJECT", scheduledDate: "", endDate: "" });
    setShowForm(false);
    loadCalendar();
  }

  async function handleRequestAction(id: string, action: "approve" | "reject") {
    setSubmitting(true);
    const res = await fetch("/api/calendar/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      showFlash(data.error ?? "Action failed", true);
      return;
    }

    showFlash(action === "approve" ? "Request approved" : "Request rejected");
    loadCalendar();
  }

  function renderEventChip(event: CalendarEvent, compact = false) {
    return (
      <div
        key={`${event.kind}-${event.id}`}
        className={cn(
          "truncate rounded border px-1 py-0.5 text-[10px] font-medium leading-tight",
          KIND_CELL_STYLES[event.kind],
          compact && "max-w-full"
        )}
        title={event.title}
      >
        {event.title}
      </div>
    );
  }

  function renderEventDetail(event: CalendarEvent) {
    return (
      <li key={`${event.kind}-${event.id}`} className="rounded-lg border border-slate-100 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">{event.title}</p>
            {event.projectTitle && (
              <p className="mt-0.5 text-xs text-slate-500">{event.projectTitle}</p>
            )}
          </div>
          {event.kind === "holiday" && event.holidayType && (
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset", HOLIDAY_TYPE_COLORS[event.holidayType])}>
              {HOLIDAY_TYPE_LABELS[event.holidayType]}
            </span>
          )}
          {event.kind === "request" && event.status && (
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset", REQUEST_STATUS_STYLES[event.status as keyof typeof REQUEST_STATUS_STYLES])}>
              {REQUEST_STATUS_LABELS[event.status as keyof typeof REQUEST_STATUS_LABELS]}
            </span>
          )}
          {event.kind === "task" && event.status && (
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", TASK_STATUS_CALENDAR_STYLES[event.status as keyof typeof TASK_STATUS_CALENDAR_STYLES])}>
              {TASK_STATUS_LABELS[event.status as keyof typeof TASK_STATUS_LABELS]}
            </span>
          )}
        </div>
        {event.details && <p className="mt-1 text-xs text-slate-500">{event.details}</p>}
        {event.assignedTo && event.kind === "task" && (
          <p className="mt-1 text-xs text-slate-400">Assigned to {event.assignedTo}</p>
        )}
        {event.requestedBy && event.kind !== "holiday" && event.kind !== "task" && (
          <p className="mt-1 text-xs text-slate-400">
            {event.requestedBy}
            {event.department ? ` · ${event.department}` : ""}
          </p>
        )}
        {(event.fieldWorkType || event.workType) && (
          <p className="mt-1 text-xs text-brand-teal-dark">
            {event.fieldWorkType
              ? FIELD_WORK_TYPE_LABELS[event.fieldWorkType as keyof typeof FIELD_WORK_TYPE_LABELS]
              : event.workType
                ? WORK_TYPE_LABELS[event.workType]
                : null}
          </p>
        )}
        {event.kind === "task" && (
          onOpenTask ? (
            <button
              type="button"
              onClick={() => onOpenTask(event.id)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-teal hover:text-brand-teal-dark"
            >
              <ClipboardList className="h-3 w-3" />
              Open task
            </button>
          ) : (
            <Link
              href="/dashboard/activities"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-teal hover:text-brand-teal-dark"
            >
              <ClipboardList className="h-3 w-3" />
              Open in Activities
            </Link>
          )
        )}
        {(event.kind === "task" || event.kind === "request") && (
          <button
            type="button"
            onClick={() => {
              if (event.kind === "task") {
                const task = loadActivityTasks().find((t) => t.id === event.id);
                if (task) exportActivityTaskExcel(task);
              } else {
                exportMeetingExcel(calendarEventToMeeting(event));
              }
            }}
            className="mt-2 ml-3 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-teal-dark"
          >
            <FileSpreadsheet className="h-3 w-3" />
            Export Excel
          </button>
        )}
      </li>
    );
  }

  const activityEvents = selectedEvents.filter((e) => e.kind === "task" || e.kind === "request");
  const otherEvents = selectedEvents.filter((e) => e.kind === "holiday" || e.kind === "leave");

  if (!calendarReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  const todayKey = localDateKey();

  return (
    <div className={cn("space-y-6", embedded && "space-y-4")}>
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-brand-teal" />
              <h1 className="text-2xl font-bold text-slate-900">Activity Calendar</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Activities organised date-wise with Indian holidays and team leave
            </p>
          </div>
          {canRequest && (
            <Button
              onClick={() => {
                setForm((f) => ({ ...f, scheduledDate: selectedDate }));
                setShowForm(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Request Activity
            </Button>
          )}
        </div>
      )}

      {embedded && canRequest && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setForm((f) => ({ ...f, scheduledDate: selectedDate }));
              setShowForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Request activity
          </Button>
        </div>
      )}

      {flash && (
        <div
          className={cn(
            "rounded-lg px-4 py-3 text-sm",
            flash.error ? "bg-red-50 text-red-700" : "bg-brand-mist text-brand-teal-dark"
          )}
        >
          {flash.msg}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs">
        {KIND_LEGEND.map((item) => (
          <span key={item.kind} className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-slate-600">
            <span className={cn("h-2 w-2 rounded-full", item.color)} />
            {item.label}
          </span>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="min-w-[180px] text-center text-lg font-semibold text-slate-900">
                  {formatMonthYear(year, month)}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => shiftMonth(1)} aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="secondary" size="sm" onClick={goToToday}>
                Today
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24 text-slate-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading calendar…
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {calendarCells.map((cell, index) => {
                    if (!cell.date) {
                      return (
                        <div
                          key={`empty-${index}`}
                          className="min-h-[110px] border-b border-r border-slate-100 bg-slate-50/40"
                        />
                      );
                    }

                    const dayEvents = sortDayEvents(eventsByDate.get(cell.date) ?? []);
                    const activityDayEvents = dayEvents.filter((e) => e.kind === "task" || e.kind === "request");
                    const isSelected = cell.date === selectedDate;
                    const isToday = cell.date === todayKey;
                    const hasHoliday = dayEvents.some((e) => e.kind === "holiday");

                    return (
                      <button
                        key={cell.date}
                        type="button"
                        onClick={() => setSelectedDate(cell.date!)}
                        className={cn(
                          "flex min-h-[110px] flex-col border-b border-r border-slate-100 p-1.5 text-left transition-colors hover:bg-brand-mist/50",
                          isSelected && "bg-brand-mist ring-1 ring-inset ring-brand-teal/30",
                          hasHoliday && !isSelected && "bg-amber-50/30"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                            isToday && "bg-brand-red text-white",
                            !isToday && "text-slate-700"
                          )}
                        >
                          {cell.day}
                        </span>
                        <div className="mt-1 flex flex-1 flex-col gap-0.5 overflow-hidden">
                          {activityDayEvents.slice(0, 3).map((event) => renderEventChip(event, true))}
                          {activityDayEvents.length > 3 && (
                            <span className="text-[10px] text-slate-400">
                              +{activityDayEvents.length - 3} more
                            </span>
                          )}
                          {activityDayEvents.length === 0 && dayEvents.length > 0 && (
                            <span className="text-[10px] text-amber-600 truncate">
                              {dayEvents.find((e) => e.kind === "holiday")?.title}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          <Card>
            <CardTitle className="text-base">Activities this month (date-wise)</CardTitle>
            {monthActivityDates.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No scheduled activities for this month.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {monthActivityDates.map(([date, dayEvents]) => {
                  const activities = dayEvents.filter((e) => e.kind === "task" || e.kind === "request");
                  if (activities.length === 0) return null;

                  return (
                    <div key={date} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() => setSelectedDate(date)}
                        className={cn(
                          "text-sm font-semibold",
                          date === selectedDate ? "text-brand-teal-dark" : "text-slate-800 hover:text-brand-teal"
                        )}
                      >
                        {formatDateKey(date, "en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </button>
                      <ul className="mt-2 space-y-2">
                        {activities.map((event) => (
                          <li
                            key={`${event.kind}-${event.id}`}
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
                              KIND_CELL_STYLES[event.kind]
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{event.title}</p>
                              {event.projectTitle && (
                                <p className="truncate text-xs opacity-75">{event.projectTitle}</p>
                              )}
                            </div>
                            {event.kind === "task" && event.status && (
                              <span className="shrink-0 text-[10px] font-medium uppercase">
                                {TASK_STATUS_LABELS[event.status as keyof typeof TASK_STATUS_LABELS]}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base">
                {formatDateKey(selectedDate, "en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </CardTitle>
              {activityEvents.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={() => {
                    const taskMap = new Map(loadActivityTasks().map((t) => [t.id, t]));
                    exportCalendarDayExcel(selectedDate, selectedEvents, taskMap);
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export day
                </Button>
              )}
            </div>

            {selectedEvents.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No events on this day.</p>
            ) : (
              <div className="mt-4 space-y-5">
                {activityEvents.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
                      Activities ({activityEvents.length})
                    </p>
                    <ul className="mt-2 space-y-2">{activityEvents.map(renderEventDetail)}</ul>
                  </div>
                )}
                {otherEvents.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Holidays & Leave
                    </p>
                    <ul className="mt-2 space-y-2">{otherEvents.map(renderEventDetail)}</ul>
                  </div>
                )}
              </div>
            )}
          </Card>

          {canApprove && pendingRequests.length > 0 && (
            <Card>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-base">Pending Requests ({pendingRequests.length})</CardTitle>
              </div>
              <ul className="mt-4 space-y-3">
                {pendingRequests.slice(0, 5).map((req) => (
                  <li key={req.id} className="rounded-lg border border-slate-100 p-3">
                    <p className="text-sm font-medium text-slate-900">{req.title}</p>
                    <p className="text-xs text-slate-500">
                      {req.requestedByName} · {req.scheduledDate}
                      {req.endDate ? ` → ${req.endDate}` : ""}
                    </p>
                    {req.description && (
                      <p className="mt-1 text-xs text-slate-500">{req.description}</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        disabled={submitting}
                        onClick={() => handleRequestAction(req.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={submitting}
                        onClick={() => handleRequestAction(req.id, "reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardTitle>Request Activity / Task</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Submit a request for your coordinator or manager to approve.
            </p>
            <form onSubmit={submitRequest} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Village awareness camp"
                />
              </div>
              <div>
                <Label htmlFor="workType">Work type</Label>
                <select
                  id="workType"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={form.workType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, workType: e.target.value as CalendarWorkType }))
                  }
                >
                  {Object.entries(WORK_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="scheduledDate">Start date</Label>
                  <Input
                    id="scheduledDate"
                    type="date"
                    required
                    value={form.scheduledDate}
                    onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End date (optional)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief details about the activity…"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit Request"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
