import { CalendarEvent } from "@/lib/calendar-types";
import {
  REQUEST_STATUS_LABELS,
  WORK_TYPE_LABELS,
} from "@/lib/calendar-types";
import { ActivityRequestStatus, CalendarWorkType } from "@/generated/prisma/enums";
import { exportSheetsToExcel, safeExportFilename } from "@/lib/excelUtils";
import {
  TASK_STATUS_LABELS,
  WORK_TYPE_LABELS as FIELD_WORK_TYPE_LABELS,
} from "@/lib/activities";
import { ActivityTaskStatus, ActivityWorkType } from "@/lib/activities";

export interface MeetingExportRow {
  id: string;
  title: string;
  description?: string | null;
  workType?: CalendarWorkType | string;
  scheduledDate: string;
  endDate?: string | null;
  status?: ActivityRequestStatus | string;
  requestedByName?: string;
  department?: string | null;
  projectId?: string | null;
  projectTitle?: string;
  reviewNotes?: string | null;
}

const MEETING_HEADERS = [
  "Title",
  "Type",
  "Status",
  "Start Date",
  "End Date",
  "Requested By",
  "Department",
  "Project",
  "Description",
  "Review Notes",
];

function meetingToRow(m: MeetingExportRow): (string | number | null)[] {
  const workTypeLabel =
    m.workType && m.workType in WORK_TYPE_LABELS
      ? WORK_TYPE_LABELS[m.workType as CalendarWorkType]
      : (m.workType ?? "");
  const statusLabel =
    m.status && m.status in REQUEST_STATUS_LABELS
      ? REQUEST_STATUS_LABELS[m.status as ActivityRequestStatus]
      : (m.status ?? "");

  return [
    m.title,
    workTypeLabel,
    statusLabel,
    m.scheduledDate,
    m.endDate ?? "",
    m.requestedByName ?? "",
    m.department ?? "",
    m.projectTitle ?? m.projectId ?? "",
    m.description ?? "",
    m.reviewNotes ?? "",
  ];
}

export function exportMeetingExcel(meeting: MeetingExportRow) {
  exportSheetsToExcel(
    [
      {
        name: "Meeting",
        headers: MEETING_HEADERS,
        rows: [meetingToRow(meeting)],
      },
    ],
    safeExportFilename("meeting", meeting.title.slice(0, 30))
  );
}

export function exportMeetingsExcel(meetings: MeetingExportRow[], filterLabel?: string) {
  exportSheetsToExcel(
    [
      {
        name: "Meetings",
        headers: MEETING_HEADERS,
        rows: meetings.map(meetingToRow),
      },
    ],
    safeExportFilename("meetings", filterLabel)
  );
}

export function exportCalendarDayExcel(
  date: string,
  events: CalendarEvent[],
  tasks?: Map<string, import("@/lib/activities").ActivityTask>
) {
  const activityRows = events
    .filter((e) => e.kind === "task" || e.kind === "request")
    .map((e) => {
      if (e.kind === "task" && tasks?.has(e.id)) {
        const task = tasks.get(e.id)!;
        return [
          "Field Activity",
          e.title,
          e.projectTitle ?? "",
          TASK_STATUS_LABELS[task.status as ActivityTaskStatus] ?? e.status ?? "",
          e.fieldWorkType
            ? FIELD_WORK_TYPE_LABELS[e.fieldWorkType as ActivityWorkType]
            : "",
          task.notes ?? e.details ?? "",
          e.assignedTo ?? "",
        ];
      }
      return [
        e.kind === "request" ? "Meeting Request" : "Field Activity",
        e.title,
        e.projectTitle ?? "",
        e.status
          ? (REQUEST_STATUS_LABELS[e.status as ActivityRequestStatus] ??
            TASK_STATUS_LABELS[e.status as ActivityTaskStatus] ??
            e.status)
          : "",
        e.workType
          ? WORK_TYPE_LABELS[e.workType]
          : e.fieldWorkType
            ? FIELD_WORK_TYPE_LABELS[e.fieldWorkType as ActivityWorkType]
            : "",
        e.details ?? "",
        e.requestedBy ?? e.assignedTo ?? "",
      ];
    });

  exportSheetsToExcel(
    [
      {
        name: "Day Activities",
        headers: ["Type", "Title", "Project", "Status", "Work Type", "Details", "Person"],
        rows: activityRows,
      },
    ],
    safeExportFilename("calendar-day", date)
  );
}

export function calendarEventToMeeting(event: CalendarEvent): MeetingExportRow {
  return {
    id: event.id,
    title: event.title,
    description: event.details,
    workType: event.workType ?? event.fieldWorkType,
    scheduledDate: event.date,
    endDate: event.endDate,
    status: event.status,
    requestedByName: event.requestedBy,
    department: event.department,
    projectTitle: event.projectTitle,
  };
}
