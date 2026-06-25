import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { hasFeature } from "@/lib/role-features";
import { deliveryScopeOwnOnly } from "@/lib/delivery-permissions";
import { deriveComplianceStatus } from "@/lib/compliance-utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(user.role, "view_pending_inbox")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const items: Array<{
    id: string;
    module: string;
    title: string;
    subtitle?: string;
    href: string;
    priority: "high" | "normal";
    dueDate?: string;
  }> = [];

  if (hasFeature(user.role, "beneficiaries.list")) {
    const deliveries = await prisma.serviceDelivery.findMany({
      where: {
        status: "DATA_ENTERED",
        ...(deliveryScopeOwnOnly(user.role) ? { enteredById: user.id } : {}),
      },
      include: {
        beneficiary: { select: { name: true, beneficiaryCode: true } },
        service: { select: { name: true } },
      },
      orderBy: { recheckDueDate: "asc" },
      take: 50,
    });

    for (const d of deliveries) {
      const overdue = d.recheckDueDate && d.recheckDueDate < now;
      items.push({
        id: `recheck-${d.id}`,
        module: "Beneficiaries",
        title: `Recheck: ${d.beneficiary.name}`,
        subtitle: d.service?.name ?? "Service",
        href: "/dashboard/beneficiaries",
        priority: overdue ? "high" : "normal",
        dueDate: d.recheckDueDate?.toISOString().slice(0, 10),
      });
    }
  }

  if (hasFeature(user.role, "finance.approve")) {
    const expenses = await prisma.expense.findMany({
      where: { status: "PENDING" },
      include: { submittedBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    for (const e of expenses) {
      items.push({
        id: `expense-${e.id}`,
        module: "Finance",
        title: `Expense approval: ₹${Number(e.amount).toLocaleString("en-IN")}`,
        subtitle: e.submittedBy.name,
        href: "/dashboard/finance",
        priority: "normal",
      });
    }
  }

  if (hasFeature(user.role, "hr.manage")) {
    const leaves = await prisma.leaveApplication.findMany({
      where: { status: "PENDING" },
      include: { employeeProfile: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    for (const l of leaves) {
      items.push({
        id: `leave-${l.id}`,
        module: "HR",
        title: `Leave request: ${l.employeeProfile.user.name}`,
        subtitle: `${l.startDate.toISOString().slice(0, 10)} → ${l.endDate.toISOString().slice(0, 10)}`,
        href: "/dashboard/hr",
        priority: "normal",
      });
    }
  }

  if (hasFeature(user.role, "calendar.approve")) {
    const requests = await prisma.activityRequest.findMany({
      where: { status: "PENDING" },
      include: { requestedBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 30,
    });
    for (const r of requests) {
      items.push({
        id: `cal-${r.id}`,
        module: "Calendar",
        title: `Calendar request: ${r.title}`,
        subtitle: r.requestedBy.name,
        href: "/dashboard/activities",
        priority: "normal",
      });
    }
  }

  if (hasFeature(user.role, "reports.view")) {
    const compliance = await prisma.complianceItem.findMany({
      where: { filedAt: null, dueDate: { lte: new Date(now.getTime() + 30 * 86400000) } },
      orderBy: { dueDate: "asc" },
      take: 20,
    });
    for (const c of compliance) {
      const status = deriveComplianceStatus(c.dueDate, c.filedAt);
      items.push({
        id: `compliance-${c.id}`,
        module: "Compliance",
        title: c.title,
        subtitle: status,
        href: "/dashboard/compliance",
        priority: status === "OVERDUE" ? "high" : "normal",
        dueDate: c.dueDate.toISOString().slice(0, 10),
      });
    }

    const pipeline = await prisma.donorPipelineEntry.findMany({
      where: {
        nextFollowUp: { lte: new Date(now.getTime() + 14 * 86400000) },
        stage: { not: "CLOSED" },
      },
      orderBy: { nextFollowUp: "asc" },
      take: 20,
    });
    for (const p of pipeline) {
      items.push({
        id: `donor-${p.id}`,
        module: "Donors",
        title: `Follow up: ${p.donorName}`,
        subtitle: p.stage.replace(/_/g, " "),
        href: "/admin/donors",
        priority: "normal",
        dueDate: p.nextFollowUp?.toISOString().slice(0, 10),
      });
    }
  }

  items.sort((a, b) => {
    if (a.priority === "high" && b.priority !== "high") return -1;
    if (b.priority === "high" && a.priority !== "high") return 1;
    return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });

  return NextResponse.json({ items, total: items.length });
}
