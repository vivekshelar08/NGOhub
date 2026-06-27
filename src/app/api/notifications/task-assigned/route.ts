import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { notifyTaskAssigned } from "@/lib/calendar-notifications";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/role-features";

const schema = z.object({
  assigneeUserId: z.string().min(1),
  title: z.string().min(1),
  projectTitle: z.string().min(1),
  scheduledDate: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "activities.assign")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await notifyTaskAssigned(prisma, {
    assigneeUserId: parsed.data.assigneeUserId,
    assignerUserId: user.id,
    assignerName: user.name,
    title: parsed.data.title,
    projectTitle: parsed.data.projectTitle,
    scheduledDate: parsed.data.scheduledDate,
  });

  return NextResponse.json({ ok: true });
}
