import {
  ActivityTask,
  ActivityTaskStatus,
  getTasksAssignedBy,
  getTasksForCoordinator,
  getTasksForUser,
  loadActivityTasks,
  TASK_STATUS_LABELS,
  WORK_TYPE_LABELS,
} from "@/lib/activities";
import type { CalendarEvent } from "@/lib/calendar-types";
import { eachDateKey } from "@/lib/hr-utils";
import { Role } from "@/generated/prisma/enums";

export function getVisibleTasks(
  userId: string,
  userRole: Role,
  canViewAll: boolean
): ActivityTask[] {
  const all = loadActivityTasks();
  if (canViewAll) return all;
  if (userRole === "COORDINATOR") {
    const ids = new Set(
      [
        ...getTasksForCoordinator(userId),
        ...getTasksForUser(userId),
        ...getTasksAssignedBy(userId),
      ].map((t) => t.id)
    );
    return all.filter((t) => ids.has(t.id));
  }
  return getTasksForUser(userId);
}

export function taskToCalendarEvent(
  task: ActivityTask,
  userNames: Map<string, string>
): CalendarEvent | null {
  const date = (task.scheduledDate ?? task.rescheduledTo)?.slice(0, 10);
  if (!date || task.status === "canceled") return null;

  return {
    id: task.id,
    kind: "task",
    title: task.title,
    date,
    status: task.status,
    fieldWorkType: task.workType,
    details: task.description ?? undefined,
    projectTitle: task.projectTitle,
    assignedTo: userNames.get(task.assignedToUserId),
    department: undefined,
  };
}

export function tasksInDateRange(
  tasks: ActivityTask[],
  from: string,
  to: string,
  userNames: Map<string, string>
): CalendarEvent[] {
  return tasks
    .map((t) => taskToCalendarEvent(t, userNames))
    .filter((e): e is CalendarEvent => e !== null && e.date >= from && e.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const start = event.date.slice(0, 10);
    const end = (event.endDate ?? event.date).slice(0, 10);
    for (const key of eachDateKey(start, end)) {
      const list = map.get(key) ?? [];
      if (!list.some((e) => e.kind === event.kind && e.id === event.id)) {
        list.push(event);
      }
      map.set(key, list);
    }
  }
  return map;
}

export const TASK_STATUS_CALENDAR_STYLES: Record<ActivityTaskStatus, string> = {
  assigned: "bg-blue-500/15 text-blue-800",
  active: "bg-amber-500/15 text-amber-800",
  completed: "bg-brand-teal/15 text-brand-teal-dark",
  rescheduled: "bg-violet-500/15 text-violet-800",
  canceled: "bg-red-500/15 text-red-800",
};

export { TASK_STATUS_LABELS, WORK_TYPE_LABELS };
