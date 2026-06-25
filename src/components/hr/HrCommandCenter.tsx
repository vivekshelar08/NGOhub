"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  RefreshCw,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Role } from "@/generated/prisma/enums";
import { LEAVE_TYPE_LABELS } from "@/lib/hr-types";
import { cn } from "@/lib/utils";
import { downloadSalarySlipByLineId } from "@/components/hr/SalarySlipsPanel";

interface HrCommandCenterProps {
  onFlash: (msg: string, isError?: boolean) => void;
  onNavigate: (tab: string) => void;
}

interface StaffTodayRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  employeeCode: string | null;
  designation: string | null;
  dayStatus: string;
  punchIn: string | null;
  punchOut: string | null;
  lateMinutes: number;
}

interface PendingLeave {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  employeeName: string;
  department: string | null;
}

interface DashboardData {
  date: string;
  stats: {
    totalStaff: number;
    present: number;
    onLeave: number;
    late: number;
    halfDay: number;
    notPunched: number;
    absent: number;
  };
  staffToday: StaffTodayRow[];
  pendingLeaves: PendingLeave[];
  payroll: {
    id: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    staffCount: number;
    lines: Array<{ lineId: string; userId: string; netPay: number | null }>;
  } | null;
  pendingEnrollments: number;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  PRESENT: { label: "Present", className: "bg-brand-mist text-brand-teal-dark" },
  LATE: { label: "Late", className: "bg-amber-100 text-amber-800" },
  ON_LEAVE: { label: "On Leave", className: "bg-blue-100 text-blue-800" },
  HALF_DAY: { label: "Half Day", className: "bg-orange-100 text-orange-800" },
  NOT_PUNCHED: { label: "Not Punched", className: "bg-slate-100 text-slate-600" },
  ABSENT: { label: "Absent", className: "bg-red-100 text-red-800" },
};

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function HrCommandCenter({ onFlash, onNavigate }: HrCommandCenterProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/hr/dashboard");
    if (!res.ok) {
      onFlash("Failed to load HR dashboard", true);
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }, [onFlash]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleLeaveAction(id: string, action: "approve" | "reject") {
    setActionLoading(id);
    const res = await fetch("/api/hr/leave", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setActionLoading(null);
    if (!res.ok) {
      const body = await res.json();
      onFlash(body.error ?? "Action failed", true);
      return;
    }
    onFlash(action === "approve" ? "Leave approved" : "Leave rejected");
    load();
  }

  async function downloadAllSlips() {
    if (!data?.payroll || data.payroll.status === "DRAFT") {
      onFlash("Process payroll first before generating salary slips", true);
      return;
    }
    setActionLoading("slips");
    let count = 0;
    for (const line of data.payroll.lines) {
      const ok = await downloadSalarySlipByLineId(line.lineId);
      if (ok) count++;
      await new Promise((r) => setTimeout(r, 400));
    }
    setActionLoading(null);
    onFlash(`Generated ${count} salary slip(s)`);
  }

  async function downloadOneSlip(lineId: string) {
    setActionLoading(lineId);
    const ok = await downloadSalarySlipByLineId(lineId, (msg) => onFlash(msg, true));
    setActionLoading(null);
    if (ok) onFlash("Salary slip downloaded");
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        Loading HR dashboard...
      </div>
    );
  }

  if (!data) return null;

  const filteredStaff =
    statusFilter === "ALL"
      ? data.staffToday
      : data.staffToday.filter((s) => s.dayStatus === statusFilter);

  const statCards = [
    { key: "ALL", label: "Total Staff", value: data.stats.totalStaff, icon: Users, color: "text-slate-700" },
    { key: "PRESENT", label: "Available Today", value: data.stats.present, icon: UserCheck, color: "text-brand-teal" },
    { key: "ON_LEAVE", label: "On Leave", value: data.stats.onLeave, icon: Calendar, color: "text-blue-600" },
    { key: "LATE", label: "Late Today", value: data.stats.late, icon: Clock, color: "text-amber-600" },
    { key: "NOT_PUNCHED", label: "Not Punched", value: data.stats.notPunched, icon: AlertCircle, color: "text-slate-500" },
    { key: "ABSENT", label: "Absent", value: data.stats.absent, icon: UserX, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-brand-teal">HRMS Control Center</p>
          <h2 className="text-lg font-semibold text-slate-900">Today — {data.date}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("mr-1 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((stat) => (
          <button
            key={stat.key}
            type="button"
            onClick={() => setStatusFilter(stat.key)}
            className={cn(
              "rounded-xl border bg-white p-4 text-left shadow-sm transition-colors",
              statusFilter === stat.key
                ? "border-brand-teal ring-1 ring-brand-teal/30"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase text-slate-500">{stat.label}</p>
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </div>
            <p className={cn("mt-1 text-2xl font-bold tabular-nums", stat.color)}>{stat.value}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden p-0 xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <CardTitle className="text-base">Staff Availability Today</CardTitle>
              <p className="text-xs text-slate-500">
                {filteredStaff.length} staff
                {statusFilter !== "ALL" ? ` · ${STATUS_STYLES[statusFilter]?.label ?? statusFilter}` : ""}
              </p>
            </div>
          </div>
          <div className="max-h-96 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Punch In</th>
                  <th className="px-4 py-3 font-medium">Punch Out</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((s) => {
                  const st = STATUS_STYLES[s.dayStatus] ?? STATUS_STYLES.NOT_PUNCHED;
                  return (
                    <tr key={s.id} className="border-b border-slate-100">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-400">
                          {s.designation ?? s.role} · {s.department ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", st.className)}>
                          {st.label}
                          {s.dayStatus === "LATE" && s.lateMinutes > 0 ? ` (${s.lateMinutes}m)` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">{formatTime(s.punchIn)}</td>
                      <td className="px-4 py-3">{formatTime(s.punchOut)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-200 px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-brand-teal" />
                Pending Leave Requests
                {data.pendingLeaves.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {data.pendingLeaves.length}
                  </span>
                )}
              </CardTitle>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {data.pendingLeaves.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">No pending requests</p>
              ) : (
                data.pendingLeaves.map((leave) => (
                  <div key={leave.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{leave.employeeName}</p>
                        <p className="text-xs text-slate-500">
                          {LEAVE_TYPE_LABELS[leave.leaveType] ?? leave.leaveType} · {leave.days} day(s)
                        </p>
                        <p className="text-xs text-slate-400">
                          {leave.startDate} → {leave.endDate}
                        </p>
                        {leave.reason && (
                          <p className="mt-1 text-xs text-slate-500">{leave.reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={actionLoading === leave.id}
                        onClick={() => handleLeaveAction(leave.id, "approve")}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={actionLoading === leave.id}
                        onClick={() => handleLeaveAction(leave.id, "reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {data.pendingLeaves.length > 0 && (
              <div className="border-t border-slate-200 px-4 py-2">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => onNavigate("leave")}>
                  View all leave management
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <CardTitle className="mb-3 flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-brand-teal" />
              Salary Slip Generation
            </CardTitle>
            {data.payroll ? (
              <div className="space-y-3 text-sm">
                <p className="text-slate-600">
                  Latest payroll: <strong>{data.payroll.periodStart}</strong> —{" "}
                  <strong>{data.payroll.periodEnd}</strong>
                </p>
                <p className="capitalize text-slate-500">
                  Status: <span className="font-medium text-slate-700">{data.payroll.status.toLowerCase()}</span>
                  {" · "}{data.payroll.staffCount} staff
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    disabled={actionLoading === "slips" || data.payroll.status === "DRAFT"}
                    onClick={downloadAllSlips}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    {actionLoading === "slips" ? "Generating..." : "Create All Salary Slips (PDF)"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => onNavigate("payroll")}>
                    Manage Payroll Runs
                  </Button>
                </div>
                {data.payroll.status === "DRAFT" && (
                  <p className="text-xs text-amber-600">Mark payroll as Processed to enable slip generation.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">No payroll run yet. Create one to generate salary slips.</p>
                <Button size="sm" onClick={() => onNavigate("payroll")}>
                  Create Payroll Run
                </Button>
              </div>
            )}
          </Card>

          {data.pendingEnrollments > 0 && (
            <Card className="border-blue-200 bg-blue-50/50">
              <p className="text-sm text-blue-800">
                <strong>{data.pendingEnrollments}</strong> active enrollment invite(s) pending
              </p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => onNavigate("enrollment")}>
                Manage Enrollments
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
