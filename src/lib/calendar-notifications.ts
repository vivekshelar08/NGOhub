import type { PrismaClient } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";
import { hasFeature } from "@/lib/role-features";

const CALENDAR_HREF = "/dashboard/activities?view=calendar";
const TASKS_HREF = "/dashboard/activities?view=tasks";

export async function getCalendarApproverIds(prisma: PrismaClient): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, role: true },
  });
  return users
    .filter((u) => hasFeature(u.role as Role, "calendar.approve"))
    .map((u) => u.id);
}

/** Notify managers/coordinators when staff requests an activity (same flow as task assignment alerts). */
export async function notifyCalendarApprovers(
  prisma: PrismaClient,
  params: {
    title: string;
    requesterName: string;
    scheduledDate: string;
    excludeUserId: string;
  }
) {
  const approverIds = (await getCalendarApproverIds(prisma)).filter(
    (id) => id !== params.excludeUserId
  );
  if (approverIds.length === 0) return;

  const body = `${params.requesterName} requested "${params.title}" for ${params.scheduledDate}. Review and approve to add it to the team calendar.`;

  await prisma.inAppNotification.createMany({
    data: approverIds.map((userId) => ({
      userId,
      title: "Activity request needs approval",
      body,
      href: CALENDAR_HREF,
    })),
  });
}

export async function notifyActivityRequestOutcome(
  prisma: PrismaClient,
  params: {
    requesterId: string;
    title: string;
    approved: boolean;
    scheduledDate: string;
    reviewNotes?: string | null;
  }
) {
  await prisma.inAppNotification.create({
    data: {
      userId: params.requesterId,
      title: params.approved ? "Activity approved — on team calendar" : "Activity request rejected",
      body: params.approved
        ? `"${params.title}" on ${params.scheduledDate} is now visible on everyone's calendar.`
        : `"${params.title}" was not approved.${params.reviewNotes ? ` Note: ${params.reviewNotes}` : ""}`,
      href: CALENDAR_HREF,
    },
  });
}

export async function notifyTaskAssigned(
  prisma: PrismaClient,
  params: {
    assigneeUserId: string;
    assignerUserId: string;
    assignerName: string;
    title: string;
    projectTitle: string;
    scheduledDate?: string;
  }
) {
  if (params.assigneeUserId === params.assignerUserId) return;

  await prisma.inAppNotification.create({
    data: {
      userId: params.assigneeUserId,
      title: "New field task assigned to you",
      body: `${params.assignerName} assigned "${params.title}" (${params.projectTitle})${
        params.scheduledDate ? ` on ${params.scheduledDate}` : ""
      }.`,
      href: TASKS_HREF,
    },
  });
}
