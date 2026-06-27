import { ActivityRequestStatus, CalendarWorkType, HolidayType } from "@/generated/prisma/enums";
import { localDateKey } from "@/lib/hr-utils";

export type CalendarEventKind = "task" | "request" | "holiday" | "leave";

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  date: string;
  endDate?: string;
  status?: ActivityRequestStatus | string;
  workType?: CalendarWorkType;
  fieldWorkType?: string;
  holidayType?: HolidayType;
  details?: string | null;
  requestedBy?: string;
  requestedById?: string;
  assignedTo?: string;
  assignedToUserId?: string;
  isMine?: boolean;
  projectTitle?: string;
  department?: string | null;
}

export const WORK_TYPE_LABELS: Record<CalendarWorkType, string> = {
  OFFICE: "Office Work",
  PROJECT: "Project Work",
  WORKSHOP: "Workshop",
  OTHER: "Other",
};

export const REQUEST_STATUS_LABELS: Record<ActivityRequestStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const REQUEST_STATUS_STYLES: Record<ActivityRequestStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-700 ring-amber-500/30",
  APPROVED: "bg-brand-teal/15 text-brand-teal-dark ring-brand-teal/30",
  REJECTED: "bg-red-500/15 text-red-700 ring-red-500/30",
  CANCELLED: "bg-slate-500/15 text-slate-600 ring-slate-500/30",
};

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  NATIONAL: "National Holiday",
  REGIONAL: "Regional Holiday",
  FESTIVAL: "Festival",
  RELIGIOUS: "Religious",
  OBSERVANCE: "Observance",
};

export const HOLIDAY_TYPE_COLORS: Record<HolidayType, string> = {
  NATIONAL: "bg-red-500/15 text-red-700 ring-red-500/30",
  REGIONAL: "bg-orange-500/15 text-orange-700 ring-orange-500/30",
  FESTIVAL: "bg-amber-500/15 text-amber-800 ring-amber-500/30",
  RELIGIOUS: "bg-violet-500/15 text-violet-700 ring-violet-500/30",
  OBSERVANCE: "bg-slate-500/15 text-slate-700 ring-slate-500/30",
};

export function getMonthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export function formatMonthYear(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function toDateKey(date: Date | string) {
  if (typeof date === "string") return date.slice(0, 10);
  return localDateKey(date);
}
