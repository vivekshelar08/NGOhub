"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  Filter,
  ListTodo,
  Plus,
  Search,
} from "lucide-react";
import { ActivityCalendarView } from "@/components/calendar/ActivityCalendarView";
import { AssignTaskForm } from "@/components/activities/AssignTaskForm";
import { TaskExecutionPanel } from "@/components/activities/TaskExecutionPanel";
import { Button } from "@/components/ui/Button";
import { formatDateKey } from "@/lib/hr-utils";
import { cn } from "@/lib/utils";
import { Role } from "@/generated/prisma/enums";
import {
  ActivityTask,
  ActivityTaskStatus,
  ActivityWorkType,
  getAdditionalActivityCoverage,
  getTasksAssignedBy,
  getTasksForCoordinator,
  getTasksForUser,
  loadActivityTasks,
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
  WORK_TYPE_LABELS,
} from "@/lib/activities";
import { exportActivityTasksExcel } from "@/lib/activityExport";
import { exportActivityBeneficiariesExcel } from "@/lib/activityBeneficiaryExport";

interface ActivitiesViewProps {
  userId: string;
  userRole: Role;
  canViewTasks: boolean;
  canAssign: boolean;
  canViewAll: boolean;
  canViewCalendar: boolean;
  canRequest: boolean;
  canApprove: boolean;
}

type MainView = "tasks" | "calendar";
type TaskTab = "my_tasks" | "team" | "assign";

export function ActivitiesView({
  userId,
  userRole,
  canViewTasks,
  canAssign,
  canViewAll,
  canViewCalendar,
  canRequest,
  canApprove,
}: ActivitiesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultView: MainView =
    !canViewCalendar && canViewTasks
      ? "tasks"
      : canViewCalendar
        ? searchParams.get("view") === "tasks" && canViewTasks
          ? "tasks"
          : "calendar"
        : "tasks";

  const [mainView, setMainView] = useState<MainView>(defaultView);
  const [tasks, setTasks] = useState<ActivityTask[]>([]);
  const [tab, setTab] = useState<TaskTab>(canAssign ? "team" : "my_tasks");
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActivityTaskStatus | "all">("all");
  const [workTypeFilter, setWorkTypeFilter] = useState<ActivityWorkType | "all">("all");
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(() => {
    setTasks(loadActivityTasks());
  }, []);

  useEffect(() => {
    refresh();
    import("@/lib/activities").then(({ ensureActivityCodes }) => ensureActivityCodes());
    window.addEventListener("activities-updated", refresh);
    window.addEventListener("projects-updated", refresh);
    return () => {
      window.removeEventListener("activities-updated", refresh);
      window.removeEventListener("projects-updated", refresh);
    };
  }, [refresh]);

  function switchMainView(view: MainView) {
    setMainView(view);
    const params = new URLSearchParams(searchParams.toString());
    if (view === "calendar") {
      params.set("view", "calendar");
    } else {
      params.delete("view");
    }
    const query = params.toString();
    router.replace(query ? `/dashboard/activities?${query}` : "/dashboard/activities", {
      scroll: false,
    });
  }

  function openTaskFromCalendar(taskId: string) {
    switchMainView("tasks");
    setTab("my_tasks");
    setSelectedTaskId(taskId);
    const task = loadActivityTasks().find((t) => t.id === taskId);
    if (task?.status === "active") {
      setFocusedTaskId(taskId);
    }
  }

  const visibleTasks = useMemo(() => {
    let list: ActivityTask[];
    if (tab === "my_tasks") {
      list = getTasksForUser(userId);
    } else if (tab === "team") {
      if (canViewAll) {
        list = tasks;
      } else if (userRole === "COORDINATOR") {
        list = getTasksForCoordinator(userId);
      } else {
        list = getTasksAssignedBy(userId);
      }
    } else {
      list = tasks;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.projectTitle.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (workTypeFilter !== "all") {
      list = list.filter((t) => t.workType === workTypeFilter);
    }

    return list.sort((a, b) => {
      const dateA = (a.scheduledDate ?? a.rescheduledTo ?? a.createdAt).slice(0, 10);
      const dateB = (b.scheduledDate ?? b.rescheduledTo ?? b.createdAt).slice(0, 10);
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return a.title.localeCompare(b.title);
    });
  }, [tab, userId, userRole, canViewAll, tasks, search, statusFilter, workTypeFilter]);

  const completedTasks = useMemo(
    () => visibleTasks.filter((t) => t.status === "completed"),
    [visibleTasks]
  );

  const tasksByDate = useMemo(() => {
    const groups = new Map<string, ActivityTask[]>();
    for (const task of visibleTasks) {
      const dateKey = (task.scheduledDate ?? task.rescheduledTo ?? task.createdAt).slice(0, 10);
      const list = groups.get(dateKey) ?? [];
      list.push(task);
      groups.set(dateKey, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visibleTasks]);

  const selectedTask = visibleTasks.find((t) => t.id === selectedTaskId) ??
    tasks.find((t) => t.id === selectedTaskId) ??
    null;

  const focusedTask =
    tasks.find((t) => t.id === focusedTaskId) ??
    visibleTasks.find((t) => t.id === focusedTaskId) ??
    null;

  function handleTaskSelect(task: ActivityTask) {
    setSelectedTaskId(task.id);
    if (task.status === "active") {
      setFocusedTaskId(task.id);
    }
  }

  function handleStartFocus(taskId: string) {
    setFocusedTaskId(taskId);
    setSelectedTaskId(taskId);
  }

  function handleExitFocus() {
    setFocusedTaskId(null);
    refresh();
  }

  const additionalCoverage = getAdditionalActivityCoverage();

  const myActiveCount = getTasksForUser(userId).filter(
    (t) => t.status === "assigned" || t.status === "active"
  ).length;

  const taskTabs: { id: TaskTab; label: string; show: boolean }[] = [
    { id: "my_tasks", label: `My tasks${myActiveCount ? ` (${myActiveCount})` : ""}`, show: true },
    { id: "team", label: canViewAll ? "All tasks" : "Team", show: canAssign || userRole === "COORDINATOR" },
    { id: "assign", label: "Assign", show: canAssign },
  ];

  const mainViews: { id: MainView; label: string; icon: typeof ListTodo; show: boolean }[] = [
    { id: "calendar", label: "Calendar", icon: CalendarDays, show: canViewCalendar },
    { id: "tasks", label: "Tasks", icon: ListTodo, show: canViewTasks },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-brand-teal" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Field work</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Your tasks, team assignments, and calendar — optimized for mobile use in the field.
          </p>
        </div>
        {canAssign && mainView === "tasks" && tab !== "assign" && (
          <Button onClick={() => { setShowAssignForm(true); setTab("assign"); }}>
            <Plus className="mr-2 h-4 w-4" />
            Assign task
          </Button>
        )}
      </div>

      {/* Main view: Tasks | Calendar */}
      {mainViews.filter((v) => v.show).length > 1 && (
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          {mainViews.filter((v) => v.show).map((view) => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => switchMainView(view.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  mainView === view.id
                    ? "bg-white text-brand-teal-dark shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Icon className="h-4 w-4" />
                {view.label}
              </button>
            );
          })}
        </div>
      )}

      {mainView === "calendar" && canViewCalendar && (
        <ActivityCalendarView
          userId={userId}
          userRole={userRole}
          canViewAll={canViewAll}
          canRequest={canRequest}
          canApprove={canApprove}
          embedded
          onOpenTask={openTaskFromCalendar}
        />
      )}

      {mainView === "tasks" && (
        <>
          {/* Summary chips */}
          <div className="flex flex-wrap gap-3">
            <SummaryChip
              label="My pending"
              value={getTasksForUser(userId).filter((t) => t.status === "assigned").length}
            />
            <SummaryChip
              label="My in progress"
              value={getTasksForUser(userId).filter((t) => t.status === "active").length}
            />
            <SummaryChip
              label="Additional coverage (reports)"
              value={`${additionalCoverage.count} activities · ${additionalCoverage.beneficiaries} beneficiaries`}
              wide
            />
          </div>

          {/* Task sub-tabs */}
          <div className="tab-bar-mobile flex gap-1 border-b border-slate-200">
            {taskTabs.filter((t) => t.show).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setShowAssignForm(false);
                  setSelectedTaskId(null);
                  setFocusedTaskId(null);
                }}
                className={cn(
                  "shrink-0 px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] sm:px-4",
                  tab === t.id
                    ? "border-b-2 border-brand-teal text-brand-teal"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Assign form */}
          {(tab === "assign" || showAssignForm) && canAssign && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <AssignTaskForm
                currentUserId={userId}
                onAssigned={() => {
                  refresh();
                  setShowAssignForm(false);
                  setTab("team");
                }}
                onCancel={() => {
                  setShowAssignForm(false);
                  setTab("team");
                }}
              />
            </div>
          )}

          {/* Task list + detail */}
          {tab !== "assign" && !showAssignForm && (
            <>
              {focusedTask ? (
                <TaskExecutionPanel
                  key={focusedTask.id}
                  task={focusedTask}
                  onUpdate={refresh}
                  onStartFocus={() => handleStartFocus(focusedTask.id)}
                  onExitFocus={handleExitFocus}
                  focused
                />
              ) : (
                <div className="grid gap-6 lg:grid-cols-5">
                  <div className="space-y-4 lg:col-span-2">
                    <div className="flex flex-wrap gap-2">
                      <div className="relative min-w-[160px] flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal"
                          placeholder="Search tasks…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <select
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as ActivityTaskStatus | "all")}
                      >
                        <option value="all">All statuses</option>
                        {(Object.keys(TASK_STATUS_LABELS) as ActivityTaskStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {TASK_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <select
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        value={workTypeFilter}
                        onChange={(e) => setWorkTypeFilter(e.target.value as ActivityWorkType | "all")}
                      >
                        <option value="all">All types</option>
                        {(Object.keys(WORK_TYPE_LABELS) as ActivityWorkType[]).map((w) => (
                          <option key={w} value={w}>
                            {WORK_TYPE_LABELS[w]}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        disabled={completedTasks.length === 0}
                        onClick={() => exportActivityTasksExcel(completedTasks)}
                        title={completedTasks.length === 0 ? "Export available after tasks are completed" : undefined}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Export activities
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        disabled={exporting || completedTasks.length === 0}
                        title={completedTasks.length === 0 ? "Export available after tasks are completed" : undefined}
                        onClick={async () => {
                          setExporting(true);
                          try {
                            await exportActivityBeneficiariesExcel(completedTasks);
                          } finally {
                            setExporting(false);
                          }
                        }}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        {exporting ? "Exporting…" : "Export beneficiaries"}
                      </Button>
                    </div>

                    {visibleTasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                        <Filter className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-2 text-sm text-slate-500">No activities match your filters.</p>
                        {canAssign && tab === "team" && (
                          <Button
                            className="mt-4"
                            size="sm"
                            onClick={() => { setShowAssignForm(true); setTab("assign"); }}
                          >
                            Assign first task
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {tasksByDate.map(([dateKey, dayTasks]) => (
                          <div key={dateKey}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {formatDateKey(dateKey, "en-IN", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                            <div className="space-y-2">
                              {dayTasks.map((task) => (
                                <TaskListCard
                                  key={task.id}
                                  task={task}
                                  selected={selectedTaskId === task.id}
                                  onClick={() => handleTaskSelect(task)}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-3">
                    {selectedTask ? (
                      <TaskExecutionPanel
                        task={selectedTask}
                        onUpdate={refresh}
                        onStartFocus={() => handleStartFocus(selectedTask.id)}
                      />
                    ) : (
                      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                        Select a task to view details or execute
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function SummaryChip({
  label,
  value,
  wide,
}: {
  label: string;
  value: number | string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white px-4 py-2.5",
        wide && "min-w-[200px]"
      )}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function TaskListCard({
  task,
  selected,
  onClick,
}: {
  task: ActivityTask;
  selected: boolean;
  onClick: () => void;
}) {
  const style = TASK_STATUS_STYLES[task.status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-brand-teal bg-brand-mist/50 ring-1 ring-brand-teal"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {task.activityCode && (
            <p className="font-mono text-[10px] font-semibold text-brand-teal-dark">
              {task.activityCode}
            </p>
          )}
          <p className="truncate font-medium text-slate-900">{task.title}</p>
          <p className="truncate text-xs text-slate-500">{task.projectTitle}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
            style.badge
          )}
        >
          {TASK_STATUS_LABELS[task.status]}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
        <span>{WORK_TYPE_LABELS[task.workType]}</span>
        {task.scheduledDate && (
          <span>· {new Date(task.scheduledDate).toLocaleDateString("en-IN")}</span>
        )}
      </div>
    </button>
  );
}
