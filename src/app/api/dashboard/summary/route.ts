import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { deliveryScopeOwnOnly } from "@/lib/delivery-permissions";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [recheckPending, recheckOverdue, pendingExpenses, pendingLeaves, attendanceToday] =
    await Promise.all([
      hasFeature(user.role, "beneficiaries.list")
        ? prisma.serviceDelivery.count({
            where: {
              status: "DATA_ENTERED",
              recheckDueDate: { gte: now },
              ...(deliveryScopeOwnOnly(user.role) ? { enteredById: user.id } : {}),
            },
          })
        : Promise.resolve(0),
      hasFeature(user.role, "beneficiaries.list")
        ? prisma.serviceDelivery.count({
            where: {
              status: "DATA_ENTERED",
              recheckDueDate: { lt: now },
              ...(deliveryScopeOwnOnly(user.role) ? { enteredById: user.id } : {}),
            },
          })
        : Promise.resolve(0),
      hasFeature(user.role, "finance.approve")
        ? prisma.expense.count({ where: { status: "PENDING" } })
        : Promise.resolve(0),
      hasFeature(user.role, "hr.manage")
        ? prisma.leaveApplication.count({ where: { status: "PENDING" } })
        : Promise.resolve(0),
      hasFeature(user.role, "hr.punch")
        ? prisma.attendanceRecord.findFirst({
            where: { userId: user.id, date: todayStart },
            select: { punchIn: true, punchOut: true },
          })
        : Promise.resolve(null),
    ]);

  const pendingInbox =
    (hasFeature(user.role, "beneficiaries.list") ? recheckPending + recheckOverdue : 0) +
    (hasFeature(user.role, "finance.approve") ? pendingExpenses : 0) +
    (hasFeature(user.role, "hr.manage") ? pendingLeaves : 0);

  return NextResponse.json({
    badges: {
      beneficiaries:
        hasFeature(user.role, "beneficiaries.list") ? recheckPending + recheckOverdue : 0,
      finance: pendingExpenses,
      hr: pendingLeaves,
      pending: pendingInbox,
    },
    work: {
      recheckPending,
      recheckOverdue,
      pendingExpenses,
      pendingLeaves,
      attendanceMarked: !!attendanceToday?.punchIn,
      attendanceComplete: !!attendanceToday?.punchOut,
    },
  });
}
