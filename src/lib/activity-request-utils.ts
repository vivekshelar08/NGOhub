import { CalendarWorkType } from "@/generated/prisma/enums";
import { ActivityWorkType } from "@/lib/activities";

export interface ActivityRequestRecord {
  id: string;
  title: string;
  description: string | null;
  workType: CalendarWorkType | string;
  scheduledDate: string;
  endDate: string | null;
  projectId: string | null;
  requestedById?: string;
  requestedByName?: string;
  status?: string;
}

export interface AssignTaskDraft {
  activityRequestId: string;
  title: string;
  description?: string;
  workType: ActivityWorkType;
  projectId?: string;
  scheduledDate?: string;
  assignedToUserId?: string;
  requesterName?: string;
}

const WORK_TYPE_MAP: Record<string, ActivityWorkType> = {
  OFFICE: "office",
  PROJECT: "project",
  WORKSHOP: "workshop",
  OTHER: "other",
};

export function calendarWorkTypeToActivity(workType: string): ActivityWorkType {
  return WORK_TYPE_MAP[workType] ?? "project";
}

export function activityWorkTypeToCalendar(workType: ActivityWorkType): CalendarWorkType {
  const entry = Object.entries(WORK_TYPE_MAP).find(([, v]) => v === workType);
  return (entry?.[0] as CalendarWorkType) ?? "PROJECT";
}

export function requestToAssignDraft(request: ActivityRequestRecord): AssignTaskDraft {
  return {
    activityRequestId: request.id,
    title: request.title,
    description: request.description ?? undefined,
    workType: calendarWorkTypeToActivity(request.workType),
    projectId: request.projectId ?? undefined,
    scheduledDate: request.scheduledDate,
    assignedToUserId: request.requestedById,
    requesterName: request.requestedByName,
  };
}
