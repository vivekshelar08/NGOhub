import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getIndianHolidaysInRange } from "@/lib/indian-holidays";
import { formatDateOnly, parseDateOnly } from "@/lib/hr-utils";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/role-features";
import type { CalendarEvent } from "@/lib/calendar-types";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "calendar.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to query params required" }, { status: 400 });
  }

  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  if (toDate < fromDate) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const viewAll = hasFeature(currentUser.role, "calendar.approve");

  const [holidays, activityRequests, leaveApplications] = await Promise.all([
    getIndianHolidaysInRange(from, to),
    prisma.activityRequest.findMany({
      where: {
        scheduledDate: { gte: fromDate, lte: toDate },
        ...(viewAll ? {} : { requestedById: currentUser.id }),
        status: { in: ["APPROVED"] },
      },
      include: {
        requestedBy: { select: { name: true, department: true } },
      },
      orderBy: { scheduledDate: "asc" },
    }),
    viewAll
      ? prisma.leaveApplication.findMany({
          where: {
            status: "APPROVED",
            startDate: { lte: toDate },
            endDate: { gte: fromDate },
          },
          include: {
            employeeProfile: {
              include: { user: { select: { name: true, department: true } } },
            },
          },
        })
      : prisma.employeeProfile
          .findUnique({ where: { userId: currentUser.id } })
          .then((profile) =>
            profile
              ? prisma.leaveApplication.findMany({
                  where: {
                    employeeProfileId: profile.id,
                    status: "APPROVED",
                    startDate: { lte: toDate },
                    endDate: { gte: fromDate },
                  },
                  include: {
                    employeeProfile: {
                      include: { user: { select: { name: true, department: true } } },
                    },
                  },
                })
              : []
          ),
  ]);

  const events: CalendarEvent[] = [];

  for (const holiday of holidays) {
    events.push({
      id: holiday.id,
      kind: "holiday",
      title: holiday.name,
      date: formatDateOnly(holiday.date),
      holidayType: holiday.type,
      details: holiday.details,
    });
  }

  for (const activity of activityRequests) {
    events.push({
      id: activity.id,
      kind: "request",
      title: activity.title,
      date: formatDateOnly(activity.scheduledDate),
      endDate: activity.endDate ? formatDateOnly(activity.endDate) : undefined,
      status: activity.status,
      workType: activity.workType,
      details: activity.description,
      requestedBy: activity.requestedBy.name,
      department: activity.requestedBy.department,
    });
  }

  for (const leave of leaveApplications) {
    events.push({
      id: leave.id,
      kind: "leave",
      title: `${leave.employeeProfile.user.name} — ${leave.leaveType} Leave`,
      date: formatDateOnly(leave.startDate),
      endDate: formatDateOnly(leave.endDate),
      status: leave.status,
      requestedBy: leave.employeeProfile.user.name,
      department: leave.employeeProfile.user.department,
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ events });
}
