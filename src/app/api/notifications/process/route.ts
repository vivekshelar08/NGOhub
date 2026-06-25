import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { processNotificationOutbox, queueNotification } from "@/lib/notify";
import { deriveComplianceStatus } from "@/lib/compliance-utils";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "admin.access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (body.action === "process_outbox") {
    const result = await processNotificationOutbox(body.limit ?? 20);
    return NextResponse.json(result);
  }

  if (body.action === "compliance_reminders") {
    const items = await prisma.complianceItem.findMany({ where: { filedAt: null } });
    const org = await prisma.orgSettings.findUnique({ where: { id: "default" } });
    const adminEmail = org?.orgEmail ?? process.env.ADMIN_NOTIFY_EMAIL;

    let queued = 0;
    for (const item of items) {
      const status = deriveComplianceStatus(item.dueDate, item.filedAt);
      if (status !== "UPCOMING" && status !== "OVERDUE") continue;

      const daysUntil = Math.ceil((item.dueDate.getTime() - Date.now()) / 86400000);
      if (daysUntil > item.reminderDays && status !== "OVERDUE") continue;

      if (adminEmail) {
        await queueNotification({
          channel: "email",
          recipient: adminEmail,
          subject: `[NGO Hub] Compliance due: ${item.title}`,
          body: `${item.title} is due on ${item.dueDate.toISOString().slice(0, 10)}. Status: ${status}.`,
        });
        queued++;
      }
    }

    const processed = await processNotificationOutbox(50);
    return NextResponse.json({ queued, ...processed });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
