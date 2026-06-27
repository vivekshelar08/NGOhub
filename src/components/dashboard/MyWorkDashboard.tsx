"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  UserPlus,
  Wallet,
  Users,
  ChevronRight,
} from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import { Card } from "@/components/ui/Card";
import { PageHeader, PageShell } from "@/components/ui/PageHeader";
import { AttendancePunchWidget } from "@/components/hr/AttendancePunchWidget";
import { TodaysActivityShareButton } from "@/components/activities/TodaysActivityShareButton";
import { hasFeature } from "@/lib/role-features";
import {
  ActivityTask,
  getTasksForCoordinator,
  getTasksForUser,
} from "@/lib/activities";
import { cn } from "@/lib/utils";

interface WorkSummary {
  recheckPending: number;
  recheckOverdue: number;
  pendingExpenses: number;
  pendingLeaves: number;
  attendanceMarked: boolean;
  attendanceComplete: boolean;
}

interface MyWorkDashboardProps {
  userId: string;
  userName: string;
  userRole: Role;
  showPunch?: boolean;
  onViewImpact?: () => void;
}

function isDueToday(task: ActivityTask) {
  if (!task.scheduledDate) return false;
  const d = new Date(task.scheduledDate);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function MyWorkDashboard({
  userId,
  userName,
  userRole,
  showPunch = false,
  onViewImpact,
}: MyWorkDashboardProps) {
  const [work, setWork] = useState<WorkSummary | null>(null);
  const [tasks, setTasks] = useState<ActivityTask[]>([]);

  useEffect(() => {
    fetch("/api/dashboard/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setWork(d.work))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function refresh() {
      let mine: ActivityTask[] = [];
      if (hasFeature(userRole, "activities.assign")) {
        mine = getTasksForCoordinator(userId);
      } else {
        mine = getTasksForUser(userId);
      }
      setTasks(mine.filter((t) => ["assigned", "active"].includes(t.status)));
    }
    refresh();
    window.addEventListener("activities-updated", refresh);
    return () => window.removeEventListener("activities-updated", refresh);
  }, [userId, userRole]);

  const dueToday = useMemo(() => tasks.filter(isDueToday), [tasks]);
  const canBeneficiaries = hasFeature(userRole, "beneficiaries.manage");
  const canFinance = hasFeature(userRole, "finance.submit");
  const canApproveFinance = hasFeature(userRole, "finance.approve");
  const canAssign = hasFeature(userRole, "activities.assign");
  const canHrManage = hasFeature(userRole, "hr.manage");
  const canShareFieldWork = hasFeature(userRole, "activities.list");

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const actionCards: Array<{
    href: string;
    label: string;
    description: string;
    count?: number;
    urgent?: boolean;
    icon: React.ReactNode;
    show: boolean;
  }> = [
    {
      href: "/dashboard/activities",
      label: "Field tasks due today",
      description: dueToday.length ? `${dueToday.length} task(s) scheduled` : "No tasks due today",
      count: dueToday.length,
      icon: <ClipboardList className="h-5 w-5" />,
      show: hasFeature(userRole, "activities.list"),
    },
    {
      href: "/dashboard/beneficiaries?tab=recheck",
      label: "Follow-ups needed",
      description:
        (work?.recheckOverdue ?? 0) > 0
          ? `${work!.recheckOverdue} overdue — act now`
          : `${work?.recheckPending ?? 0} pending check-ins`,
      count: (work?.recheckPending ?? 0) + (work?.recheckOverdue ?? 0),
      urgent: (work?.recheckOverdue ?? 0) > 0,
      icon: <Users className="h-5 w-5" />,
      show: hasFeature(userRole, "beneficiaries.list"),
    },
    {
      href: "/dashboard/finance?tab=approvals",
      label: "Expense approvals",
      description: `${work?.pendingExpenses ?? 0} waiting for your review`,
      count: work?.pendingExpenses,
      icon: <Wallet className="h-5 w-5" />,
      show: canApproveFinance,
    },
    {
      href: "/dashboard/hr",
      label: "Leave requests",
      description: `${work?.pendingLeaves ?? 0} pending approval`,
      count: work?.pendingLeaves,
      icon: <Clock className="h-5 w-5" />,
      show: canHrManage,
    },
  ];

  const quickActions = [
    { href: "/dashboard/beneficiaries?tab=add", label: "Add beneficiary", icon: UserPlus, show: canBeneficiaries },
    { href: "/dashboard/finance", label: "Submit expense", icon: Wallet, show: canFinance },
    { href: "/dashboard/activities", label: "My field work", icon: ClipboardList, show: hasFeature(userRole, "activities.list") },
    { href: "/dashboard/activities?tab=assign", label: "Assign task", icon: ClipboardList, show: canAssign },
    { href: "/dashboard/pending", label: "Pending inbox", icon: ClipboardList, show: hasFeature(userRole, "pending.view") },
    { href: "/dashboard/compliance", label: "Compliance", icon: Clock, show: hasFeature(userRole, "finance.reports") },
    { href: "/dashboard/partners", label: "Partners", icon: Users, show: hasFeature(userRole, "projects.edit") },
    { href: "/dashboard/volunteers", label: "Volunteers", icon: Users, show: hasFeature(userRole, "activities.list") },
  ].filter((a) => a.show);

  return (
    <PageShell>
      {showPunch && <AttendancePunchWidget userName={userName} />}

      <PageHeader
        eyebrow="Home"
        title={`${greeting}, ${userName.split(" ")[0]}`}
        description="Here is what needs your attention today."
        actions={
          onViewImpact ? (
            <button
              type="button"
              onClick={onViewImpact}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              View impact report
            </button>
          ) : undefined
        }
      />

      {showPunch && work && !work.attendanceMarked && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm font-medium text-amber-900">
              You have not marked attendance today. Use the punch card above.
            </p>
          </div>
        </Card>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {actionCards
          .filter((c) => c.show && (c.count ?? 0) > 0)
          .map((card) => (
            <Link key={card.href} href={card.href}>
              <Card
                className={cn(
                  "flex items-center gap-4 p-4 transition-shadow hover:shadow-md active:scale-[0.99]",
                  card.urgent && "border-red-200 bg-red-50/50"
                )}
              >
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    card.urgent ? "bg-red-100 text-red-700" : "bg-brand-mist text-brand-teal-dark"
                  )}
                >
                  {card.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{card.label}</p>
                  <p className="text-sm text-slate-500">{card.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {card.count != null && card.count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-sm font-bold",
                        card.urgent ? "bg-red-200 text-red-800" : "bg-brand-teal/10 text-brand-teal-dark"
                      )}
                    >
                      {card.count}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </Card>
            </Link>
          ))}
      </div>

      {actionCards.filter((c) => c.show && (c.count ?? 0) > 0).length === 0 && (
        <Card className="mb-6 flex items-center gap-3 p-5 text-emerald-800 bg-emerald-50 border-emerald-200">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">You are all caught up for now.</p>
        </Card>
      )}

      {canShareFieldWork && (
        <Card className="mb-6 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">Today&apos;s field work</p>
              <p className="mt-1 text-sm text-slate-500">
                Share a short summary of what you completed today with your team on WhatsApp.
              </p>
            </div>
            <TodaysActivityShareButton userId={userId} userName={userName} />
          </div>
        </Card>
      )}

      {quickActions.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Quick actions
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-all hover:border-brand-teal/40 hover:shadow-md active:scale-[0.98]"
              >
                <action.icon className="h-6 w-6 text-brand-teal" />
                <span className="text-sm font-medium text-slate-800">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {dueToday.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Today&apos;s field work
          </h2>
          <div className="space-y-2">
            {dueToday.slice(0, 5).map((task) => (
              <Link key={task.id} href={`/dashboard/activities?task=${task.id}`}>
                <Card className="flex items-center justify-between gap-3 p-4 hover:shadow-md">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{task.title}</p>
                    <p className="text-sm text-slate-500">{task.projectTitle ?? "Field task"}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(work?.recheckOverdue ?? 0) > 0 && (
        <Card className="mt-4 flex items-start gap-3 border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-red-900">
              {work!.recheckOverdue} overdue follow-up{work!.recheckOverdue > 1 ? "s" : ""}
            </p>
            <Link
              href="/dashboard/beneficiaries?tab=recheck"
              className="mt-1 inline-block text-sm font-medium text-red-700 underline"
            >
              Review now →
            </Link>
          </div>
        </Card>
      )}
    </PageShell>
  );
}
