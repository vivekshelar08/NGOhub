import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { deliveryScopeOwnOnly } from "@/lib/delivery-permissions";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.inAppNotification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount: notifications.filter((n) => !n.read).length,
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (body.markAllRead) {
    await prisma.inAppNotification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    await prisma.inAppNotification.updateMany({
      where: { id: body.id, userId: user.id },
      data: { read: true },
    });
  }

  return NextResponse.json({ ok: true });
}

/** Sync pending work items into in-app notifications (idempotent per day). */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const created: string[] = [];

  async function notifyOnce(key: string, title: string, body: string, href: string) {
    const existing = await prisma.inAppNotification.findFirst({
      where: {
        userId: user!.id,
        title,
        createdAt: { gte: today },
      },
    });
    if (existing) return;
    await prisma.inAppNotification.create({
      data: { userId: user!.id, title, body, href },
    });
    created.push(key);
  }

  const now = new Date();
  const recheckOverdue = await prisma.serviceDelivery.count({
    where: {
      status: "DATA_ENTERED",
      recheckDueDate: { lt: now },
      ...(deliveryScopeOwnOnly(user.role) ? { enteredById: user.id } : {}),
    },
  });
  if (recheckOverdue > 0) {
    await notifyOnce(
      "recheck",
      "Follow-ups overdue",
      `${recheckOverdue} beneficiary follow-up(s) need attention`,
      "/dashboard/beneficiaries?tab=recheck"
    );
  }

  const pendingExpenses = await prisma.expense.count({ where: { status: "PENDING" } });
  if (pendingExpenses > 0 && ["ADMIN", "MANAGER"].includes(user.role)) {
    await notifyOnce(
      "expenses",
      "Expenses to approve",
      `${pendingExpenses} expense(s) waiting for approval`,
      "/dashboard/finance?tab=approvals"
    );
  }

  const openFeedback = await prisma.beneficiaryFeedback.count({ where: { status: "OPEN" } });
  if (openFeedback > 0) {
    await notifyOnce(
      "feedback",
      "Open feedback",
      `${openFeedback} beneficiary feedback item(s) open`,
      "/dashboard/beneficiaries"
    );
  }

  const dueCompliance = await prisma.complianceItem.count({
    where: { status: { in: ["DUE", "OVERDUE"] } },
  });
  if (dueCompliance > 0 && user.role === "ADMIN") {
    await notifyOnce(
      "compliance",
      "Compliance due",
      `${dueCompliance} compliance item(s) due or overdue`,
      "/dashboard/compliance"
    );
  }

  return NextResponse.json({ synced: created.length });
}
