"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS } from "@/lib/hr-types";

interface LeaveBalance {
  year: number;
  casual: { total: number; used: number };
  sick: { total: number; used: number };
  earned: { total: number; used: number };
}

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

export function LeaveManagementPanel({ canManageHr, onFlash }: LeaveManagementPanelProps) {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ leaveType: "CL", startDate: "", endDate: "", reason: "" });

  const load = useCallback(async () => {
    const url = canManageHr ? "/api/hr/leave?all=1" : "/api/hr/leave";
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    setBalance(data.balance);
    setApplications(data.applications ?? []);
  }, [canManageHr]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
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
    onFlash(action === "approve" ? "Leave approved" : "Leave rejected");
    load();
  }

  return (
    <div className="space-y-6">
      {balance && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Casual Leave", data: balance.casual },
            { label: "Sick Leave", data: balance.sick },
            { label: "Earned Leave", data: balance.earned },
          ].map((item) => (
            <Card key={item.label} className="p-4">
              <p className="text-xs font-medium uppercase text-slate-500">{item.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {item.data.total - item.data.used}
                <span className="text-sm font-normal text-slate-400"> / {item.data.total}</span>
              </p>
              <p className="text-xs text-slate-400">{item.data.used} used in {balance.year}</p>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardTitle className="mb-4 text-lg">Apply for Leave</CardTitle>
        <form onSubmit={submitLeave} className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Leave type</Label>
            <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
              <option value="CL">Casual Leave</option>
              <option value="SL">Sick Leave</option>
              <option value="EL">Earned Leave</option>
            </select>
          </div>
          <div>
            <Label>Reason</Label>
            <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div>
            <Label>Start date</Label>
            <Input type="date" required value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div>
            <Label>End date</Label>
            <Input type="date" required value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={loading}>Submit Application</Button>
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
                    <td className="px-4 py-3">{a.startDate} → {a.endDate}</td>
                    <td className="px-4 py-3">{a.days}</td>
                    <td className="px-4 py-3">{LEAVE_STATUS_LABELS[a.status] ?? a.status}</td>
                    {canManageHr && (
                      <td className="px-4 py-3">
                        {a.status === "PENDING" && (
                          <div className="flex gap-2">
                            <Button size="sm" disabled={loading} onClick={() => handleAction(a.id, "approve")}>
                              Approve
                            </Button>
                            <Button size="sm" variant="danger" disabled={loading} onClick={() => handleAction(a.id, "reject")}>
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
