"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS } from "@/lib/hr-types";
import { countLeaveDays, type LeaveBalanceSummary, type LeaveTypeCode } from "@/lib/leave-balance";
import { parseDateOnly } from "@/lib/hr-utils";
import { cn } from "@/lib/utils";

interface LeaveApplication {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  employeeName?: string;
  department?: string | null;
}

interface LeaveManagementPanelProps {
  canManageHr: boolean;
  onFlash: (msg: string, isError?: boolean) => void;
}

const LEAVE_TYPE_OPTIONS: Array<{
  value: LeaveTypeCode | "EM";
  key: keyof Pick<LeaveBalanceSummary, "casual" | "sick" | "earned"> | null;
  label: string;
}> = [
  { value: "CL", key: "casual", label: "Casual Leave" },
  { value: "SL", key: "sick", label: "Sick Leave" },
  { value: "EL", key: "earned", label: "Earned Leave" },
  { value: "EM", key: null, label: "Emergency Leave" },
];

function countRequestedDays(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (end < start) return null;
  return countLeaveDays(start, end);
}

export function LeaveManagementPanel({ canManageHr, onFlash }: LeaveManagementPanelProps) {
  const [balance, setBalance] = useState<LeaveBalanceSummary | null>(null);
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ leaveType: "CL" as LeaveTypeCode | "EM", startDate: "", endDate: "", reason: "" });

  const load = useCallback(async () => {
    const url = canManageHr ? "/api/hr/leave?all=1" : "/api/hr/leave";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setBalance(data.balance);
    setApplications(data.applications ?? []);
  }, [canManageHr]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const requestedDays = useMemo(
    () => countRequestedDays(form.startDate, form.endDate),
    [form.startDate, form.endDate]
  );

  const selectedBalance = useMemo(() => {
    if (!balance || form.leaveType === "EM") return null;
    const option = LEAVE_TYPE_OPTIONS.find((item) => item.value === form.leaveType);
    return option?.key ? balance[option.key] : null;
  }, [balance, form.leaveType]);

  const remainingAfterRequest =
    selectedBalance && requestedDays != null ? selectedBalance.available - requestedDays : null;

  const canSubmit =
    !loading &&
    requestedDays != null &&
    requestedDays > 0 &&
    (form.leaveType === "EM" ||
      (selectedBalance != null && remainingAfterRequest != null && remainingAfterRequest >= 0));

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    const res = await fetch("/api/hr/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      onFlash(data.error ?? "Failed to apply", true);
      load();
      return;
    }
    onFlash("Leave application submitted");
    setForm({ leaveType: "CL", startDate: "", endDate: "", reason: "" });
    load();
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    setLoading(true);
    const res = await fetch("/api/hr/leave", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      onFlash(data.error ?? "Action failed", true);
      return;
    }
    const data = await res.json();
    if (action === "approve" && data.tasksNeedingReassign > 0) {
      onFlash(
        `Leave approved. ${data.tasksNeedingReassign} field task(s) need urgent reassignment — check Field work → Assign.`,
        false
      );
    } else {
      onFlash(action === "approve" ? "Leave approved" : "Leave rejected");
    }
    load();
  }

  return (
    <div className="space-y-6">
      {balance ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {LEAVE_TYPE_OPTIONS.filter((item) => item.key).map((item) => {
            const data = balance[item.key!];
            const isSelected = form.leaveType === item.value;
            return (
              <Card
                key={item.value}
                className={cn(
                  "p-4 transition-colors",
                  isSelected && "border-emerald-500 ring-1 ring-emerald-500"
                )}
              >
                <p className="text-xs font-medium uppercase text-slate-500">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {data.available}
                  <span className="text-sm font-normal text-slate-400"> / {data.total}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {data.used} used · {data.pending} pending
                </p>
                <p className="text-xs text-slate-400">available in {balance.year}</p>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-4 text-sm text-slate-500">
          Leave balance is not available yet. Complete your employee profile or contact HR.
        </Card>
      )}

      <Card>
        <CardTitle className="mb-4 text-lg">Apply for Leave</CardTitle>
        {form.leaveType === "EM" && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            Emergency leave does not use CL/SL/EL balance. Assigned field tasks may need manager reassignment.
          </div>
        )}
        {selectedBalance && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-medium text-slate-900">
              {LEAVE_TYPE_LABELS[form.leaveType]} — {selectedBalance.available} day(s) available
            </p>
            <p className="mt-1 text-slate-600">
              {selectedBalance.total} total · {selectedBalance.used} used · {selectedBalance.pending} pending approval
            </p>
            {requestedDays != null && (
              <p
                className={cn(
                  "mt-2 font-medium",
                  remainingAfterRequest != null && remainingAfterRequest < 0
                    ? "text-red-600"
                    : "text-emerald-700"
                )}
              >
                Requesting {requestedDays} day(s)
                {remainingAfterRequest != null &&
                  (remainingAfterRequest >= 0
                    ? ` · ${remainingAfterRequest} will remain after this request`
                    : ` · exceeds available balance by ${Math.abs(remainingAfterRequest)} day(s)`)}
              </p>
            )}
          </div>
        )}
        <form onSubmit={submitLeave} className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Leave type</Label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              value={form.leaveType}
              onChange={(e) =>
                setForm({ ...form, leaveType: e.target.value as LeaveTypeCode | "EM" })
              }
            >
              {LEAVE_TYPE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Reason</Label>
            <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div>
            <Label>Start date</Label>
            <Input
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </div>
          <div>
            <Label>End date</Label>
            <Input
              type="date"
              required
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={!canSubmit}>
              Submit Application
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">
            {canManageHr ? "All Leave Applications" : "My Leave History"}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                {canManageHr && <th className="px-4 py-3 font-medium">Employee</th>}
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Days</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canManageHr && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={canManageHr ? 6 : 4} className="px-4 py-8 text-center text-slate-400">
                    No leave applications
                  </td>
                </tr>
              ) : (
                applications.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100">
                    {canManageHr && (
                      <td className="px-4 py-3">
                        <p className="font-medium">{a.employeeName}</p>
                        <p className="text-xs text-slate-400">{a.department ?? "—"}</p>
                      </td>
                    )}
                    <td className="px-4 py-3">{LEAVE_TYPE_LABELS[a.leaveType] ?? a.leaveType}</td>
                    <td className="px-4 py-3">
                      {a.startDate} → {a.endDate}
                    </td>
                    <td className="px-4 py-3">{a.days}</td>
                    <td className="px-4 py-3">{LEAVE_STATUS_LABELS[a.status] ?? a.status}</td>
                    {canManageHr && (
                      <td className="px-4 py-3">
                        {a.status === "PENDING" && (
                          <div className="flex gap-2">
                            <Button size="sm" disabled={loading} onClick={() => handleAction(a.id, "approve")}>
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={loading}
                              onClick={() => handleAction(a.id, "reject")}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
