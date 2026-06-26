"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Calendar,
  Clock,
  Copy,
  DollarSign,
  Link2,
  LogIn,
  Settings,
  Star,
  FileText,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Role } from "@/generated/prisma/enums";
import {
  ATTENDANCE_STATUS_LABELS,
  PAYROLL_STATUS_LABELS,
  RATING_LABELS,
} from "@/lib/hr-utils";
import { EmployeeProfileForm, HrPolicySettingsForm } from "@/components/hr/HrForms";
import { MyAttendancePanel } from "@/components/hr/MyAttendancePanel";
import { LeaveManagementPanel } from "@/components/hr/LeaveManagementPanel";
import { SalarySlipsPanel, downloadSalarySlipByLineId } from "@/components/hr/SalarySlipsPanel";
import { HrCommandCenter } from "@/components/hr/HrCommandCenter";
import { DEFAULT_HR_POLICY, HrPolicyBundle, McaEmployeeProfile } from "@/lib/hr-types";

interface HrManagementViewProps {
  userId: string;
  userName: string;
  canManageHr: boolean;
}

type HrTab = "dashboard" | "attendance" | "leave" | "salary_slips" | "staff" | "payroll" | "performance" | "enrollment" | "settings";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  phone: string | null;
  employeeProfile: (McaEmployeeProfile & {
    payrollSettings?: HrPolicyBundle["payroll"];
    leaveSettings?: HrPolicyBundle["leave"];
    lateMarkSettings?: HrPolicyBundle["lateMark"];
  }) | null;
}

interface AttendanceRecord {
  id: string;
  date: string;
  punchIn: string | null;
  punchOut: string | null;
  status: string;
  lateMinutes?: number;
  isLateMark?: boolean;
  user?: { name: string; department: string | null };
}

interface PayrollRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  notes: string | null;
  lines: Array<{
    id: string;
    userName: string;
    department: string | null;
    baseSalary: number;
    deductions: number;
    bonuses: number;
    netPay: number;
  }>;
}

interface PerformanceReview {
  id: string;
  period: string;
  rating: number;
  comments: string | null;
  user: { name: string; department: string | null };
  reviewer: { name: string };
}

interface EnrollmentInvite {
  id: string;
  token: string;
  email: string | null;
  name: string | null;
  role: Role;
  department: string | null;
  expiresAt: string;
  usedAt: string | null;
  shareUrl: string;
  isExpired: boolean;
  isUsed: boolean;
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export function HrManagementView({
  userId,
  userName,
  canManageHr,
}: HrManagementViewProps) {
  const [tab, setTab] = useState<HrTab>(canManageHr ? "dashboard" : "attendance");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [invites, setInvites] = useState<EnrollmentInvite[]>([]);

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<McaEmployeeProfile>({});
  const [employeePolicy, setEmployeePolicy] = useState<HrPolicyBundle>(DEFAULT_HR_POLICY);
  const [orgPolicy, setOrgPolicy] = useState<HrPolicyBundle>(DEFAULT_HR_POLICY);
  const [invitePolicy, setInvitePolicy] = useState<HrPolicyBundle>(DEFAULT_HR_POLICY);
  const [invitePreset, setInvitePreset] = useState<McaEmployeeProfile>({});

  const [payrollForm, setPayrollForm] = useState({
    periodStart: "",
    periodEnd: "",
    notes: "",
  });

  const [reviewForm, setReviewForm] = useState({
    userId: "",
    period: "",
    rating: 3,
    comments: "",
  });

  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    role: "STAFF" as Role,
    department: "",
    expiresInDays: 7,
  });

  const [loginForm, setLoginForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "STAFF" as Role,
    department: "",
    phone: "",
  });

  const currentMonth = new Date().toISOString().slice(0, 7);

  const flash = useCallback((msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setSuccess("");
    } else {
      setSuccess(msg);
      setError("");
    }
    setTimeout(() => {
      setError("");
      setSuccess("");
    }, 4000);
  }, []);

  const loadAttendance = useCallback(async () => {
    const url = canManageHr
      ? `/api/hr/attendance?teamMonth=${currentMonth}&month=${currentMonth}`
      : `/api/hr/attendance?month=${currentMonth}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    setAttendanceRecords(data.records ?? []);
    if (!canManageHr) setTodayRecord(data.todayRecord ?? null);
  }, [currentMonth, canManageHr]);

  const loadStaff = useCallback(async () => {
    const res = await fetch("/api/hr/staff");
    if (!res.ok) return;
    const data = await res.json();
    setStaff(data.staff ?? []);
  }, []);

  const loadPayroll = useCallback(async () => {
    const res = await fetch("/api/hr/payroll");
    if (!res.ok) return;
    const data = await res.json();
    setPayrollRuns(data.runs ?? []);
  }, []);

  const loadReviews = useCallback(async () => {
    const res = await fetch("/api/hr/performance");
    if (!res.ok) return;
    const data = await res.json();
    setReviews(data.reviews ?? []);
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/hr/settings");
    if (!res.ok) return;
    const data = await res.json();
    setOrgPolicy(data.settings ?? DEFAULT_HR_POLICY);
    setInvitePolicy(data.settings ?? DEFAULT_HR_POLICY);
  }, []);

  const loadInvites = useCallback(async () => {
    const res = await fetch("/api/hr/enrollment");
    if (!res.ok) return;
    const data = await res.json();
    setInvites(data.invites ?? []);
  }, []);

  useEffect(() => {
    if (tab === "attendance") loadAttendance();
  }, [tab, loadAttendance]);

  useEffect(() => {
    if (tab === "staff" && canManageHr) loadStaff();
    if (tab === "payroll" && canManageHr) loadPayroll();
    if (tab === "performance") {
      loadReviews();
      if (canManageHr) loadStaff();
    }
    if (tab === "settings" && canManageHr) loadSettings();
    if (tab === "enrollment" && canManageHr) {
      loadInvites();
      loadStaff();
      loadSettings();
    }
  }, [tab, canManageHr, loadStaff, loadPayroll, loadReviews, loadInvites, loadSettings]);

  async function handlePunch(action: "in" | "out") {
    setLoading(true);
    const res = await fetch("/api/hr/attendance/punch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      flash(data.error ?? "Punch failed", true);
      return;
    }
    const data = await res.json();
    if (data.lateInfo) {
      flash(`Punched in — ${data.lateInfo.message}`);
    } else {
      flash(action === "in" ? "Punched in successfully" : "Punched out successfully");
    }
    loadAttendance();
  }

  function startEditStaff(member: StaffMember) {
    setEditingStaffId(member.id);
    const p = member.employeeProfile;
    setProfileForm({
      employeeCode: p?.employeeCode ?? "",
      designation: p?.designation ?? "",
      department: p?.department ?? member.department ?? "",
      joinDate: p?.joinDate ?? "",
      confirmationDate: p?.confirmationDate ?? "",
      employmentType: p?.employmentType ?? "PERMANENT",
      workLocation: p?.workLocation ?? "",
      probationEndDate: p?.probationEndDate ?? "",
      fatherOrSpouseName: p?.fatherOrSpouseName ?? "",
      dateOfBirth: p?.dateOfBirth ?? "",
      gender: p?.gender,
      maritalStatus: p?.maritalStatus,
      nationality: p?.nationality ?? "Indian",
      bloodGroup: p?.bloodGroup ?? "",
      permanentAddress: p?.permanentAddress ?? "",
      currentAddress: p?.currentAddress ?? "",
      emergencyContactName: p?.emergencyContactName ?? "",
      emergencyContactPhone: p?.emergencyContactPhone ?? "",
      panNumber: p?.panNumber ?? "",
      aadhaarNumber: p?.aadhaarNumber ?? "",
      uanNumber: p?.uanNumber ?? "",
      esicNumber: p?.esicNumber ?? "",
      passportNumber: p?.passportNumber ?? "",
      bankName: p?.bankName ?? "",
      bankAccountNumber: p?.bankAccountNumber ?? "",
      bankIfsc: p?.bankIfsc ?? "",
      bankAccountHolderName: p?.bankAccountHolderName ?? "",
      ctc: p?.ctc ?? undefined,
      basicSalary: p?.basicSalary ?? undefined,
      hra: p?.hra ?? undefined,
      conveyanceAllowance: p?.conveyanceAllowance ?? undefined,
      specialAllowance: p?.specialAllowance ?? undefined,
      baseSalary: p?.baseSalary ?? undefined,
    });
    setEmployeePolicy({
      payroll: p?.payrollSettings ?? orgPolicy.payroll,
      leave: p?.leaveSettings ?? orgPolicy.leave,
      lateMark: p?.lateMarkSettings ?? orgPolicy.lateMark,
    });
  }

  async function saveStaffProfile(memberId: string) {
    setLoading(true);
    const res = await fetch("/api/hr/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: memberId,
        ...profileForm,
        payroll: employeePolicy.payroll,
        leave: employeePolicy.leave,
        lateMark: employeePolicy.lateMark,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      flash(data.error ?? "Save failed", true);
      return;
    }
    flash("MCA employee profile saved");
    setEditingStaffId(null);
    loadStaff();
  }

  async function saveOrgSettings() {
    setLoading(true);
    const res = await fetch("/api/hr/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orgPolicy),
    });
    setLoading(false);
    if (!res.ok) {
      flash("Failed to save settings", true);
      return;
    }
    flash("Organization HR policy settings saved");
    loadSettings();
  }

  async function createPayrollRun(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/hr/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payrollForm),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      flash(data.error ?? "Failed to create payroll", true);
      return;
    }
    flash("Payroll run created");
    setPayrollForm({ periodStart: "", periodEnd: "", notes: "" });
    loadPayroll();
  }

  async function advancePayrollStatus(runId: string) {
    setLoading(true);
    const res = await fetch(`/api/hr/payroll/${runId}`, { method: "PATCH" });
    setLoading(false);
    if (!res.ok) {
      flash("Failed to update payroll status", true);
      return;
    }
    flash("Payroll status updated");
    loadPayroll();
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/hr/performance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reviewForm),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      flash(data.error ?? "Failed to submit review", true);
      return;
    }
    flash("Performance review submitted");
    setReviewForm({ userId: "", period: "", rating: 3, comments: "" });
    loadReviews();
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/hr/enrollment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...inviteForm,
        payroll: invitePolicy.payroll,
        leave: invitePolicy.leave,
        lateMark: invitePolicy.lateMark,
        employeePreset: invitePreset,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      flash(data.error ?? "Failed to create invite", true);
      return;
    }
    const data = await res.json();
    const shareUrl =
      data.invite?.shareUrl ||
      `${typeof window !== "undefined" ? window.location.origin : ""}/enroll/${data.invite?.token}`;
    flash("Enrollment link created — copy and share with staff");
    if (shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        /* clipboard optional */
      }
    }
    setInviteForm({ email: "", name: "", role: "STAFF", department: "", expiresInDays: 7 });
    loadInvites();
  }

  async function createLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      flash(data.error ?? "Failed to create login", true);
      return;
    }
    flash("Staff login created successfully");
    setLoginForm({ name: "", email: "", password: "", role: "STAFF", department: "", phone: "" });
    loadStaff();
  }

  async function downloadSlip(lineId: string) {
    setLoading(true);
    const ok = await downloadSalarySlipByLineId(lineId, (msg) => flash(msg, true));
    setLoading(false);
    if (ok) flash("Salary slip downloaded");
  }

  async function downloadAllSlips(run: PayrollRun) {
    setLoading(true);
    let count = 0;
    for (const line of run.lines) {
      const ok = await downloadSalarySlipByLineId(line.id);
      if (ok) count++;
      await new Promise((r) => setTimeout(r, 400));
    }
    setLoading(false);
    flash(count > 0 ? `Downloaded ${count} salary slip(s)` : "No slips generated", count === 0);
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied to clipboard");
    } catch {
      flash("Could not copy link", true);
    }
  }

  const tabs: { id: HrTab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: "dashboard", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" />, show: canManageHr },
    { id: "attendance", label: "Attendance", icon: <Clock className="h-4 w-4" />, show: true },
    { id: "leave", label: "Leave", icon: <Calendar className="h-4 w-4" />, show: true },
    { id: "salary_slips", label: "Salary", icon: <FileText className="h-4 w-4" />, show: !canManageHr },
    { id: "staff", label: "Staff", icon: <Users className="h-4 w-4" />, show: canManageHr },
    { id: "payroll", label: "Payroll", icon: <DollarSign className="h-4 w-4" />, show: canManageHr },
    { id: "performance", label: canManageHr ? "Reviews" : "My ratings", icon: <Star className="h-4 w-4" />, show: true },
    { id: "enrollment", label: "Hiring", icon: <UserPlus className="h-4 w-4" />, show: canManageHr },
    { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" />, show: canManageHr },
  ];

  const punchedIn = !!todayRecord?.punchIn;
  const punchedOut = !!todayRecord?.punchOut;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          {canManageHr ? "HR management" : "My HR"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {canManageHr
            ? "Attendance, leave, payroll, and team management"
            : "Your attendance, leave, salary slips, and ratings"}
        </p>
      </div>

      {(error || success) && (
        <div
          className={cn(
            "rounded-lg px-4 py-3 text-sm",
            error ? "bg-red-50 text-red-700" : "bg-brand-mist text-brand-teal-dark"
          )}
        >
          {error || success}
        </div>
      )}

      <div className="tab-bar-mobile flex gap-2 border-b border-slate-200 pb-1">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] sm:px-4",
                tab === t.id
                  ? "border-b-2 border-brand-red text-brand-teal-dark"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
      </div>

      {tab === "dashboard" && canManageHr && (
        <HrCommandCenter
          onFlash={flash}
          onNavigate={(t) => setTab(t as HrTab)}
        />
      )}

      {tab === "attendance" && canManageHr && (
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Team Attendance — {currentMonth}</h2>
              <p className="text-sm text-slate-500">All staff punch records for the selected month</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Punch In</th>
                    <th className="px-4 py-3 font-medium">Punch Out</th>
                    <th className="px-4 py-3 font-medium">Late</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No team attendance records this month
                      </td>
                    </tr>
                  ) : (
                    attendanceRecords.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="px-4 py-3">
                          <p className="font-medium">{r.user?.name ?? "—"}</p>
                          <p className="text-xs text-slate-400">{r.user?.department ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3">{formatDate(r.date)}</td>
                        <td className="px-4 py-3">{formatTime(r.punchIn)}</td>
                        <td className="px-4 py-3">{formatTime(r.punchOut)}</td>
                        <td className="px-4 py-3">
                          {r.isLateMark ? (
                            <span className="text-amber-600">{r.lateMinutes ?? 0}m late</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {ATTENDANCE_STATUS_LABELS[r.status] ?? r.status.toLowerCase()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "attendance" && !canManageHr && (
        <MyAttendancePanel userId={userId} onFlash={flash} />
      )}

      {tab === "leave" && (
        <LeaveManagementPanel canManageHr={canManageHr} onFlash={flash} />
      )}

      {tab === "salary_slips" && (
        <SalarySlipsPanel onFlash={flash} />
      )}

      {tab === "staff" && canManageHr && (
        <div className="space-y-4">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Staff Directory — MCA Register</h2>
              <p className="text-sm text-slate-500">Full employee profiles per MCA standards</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Designation</th>
                    <th className="px-4 py-3 font-medium">PAN</th>
                    <th className="px-4 py-3 font-medium">Basic Salary</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id} className="border-b border-slate-100">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{member.name}</p>
                        <p className="text-xs text-slate-400">{member.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge role={member.role} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {member.employeeProfile?.designation ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {member.employeeProfile?.panNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {member.employeeProfile?.basicSalary != null
                          ? `₹${member.employeeProfile.basicSalary.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" onClick={() => startEditStaff(member)}>
                          Edit Profile
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {editingStaffId && (
            <Card>
              <CardTitle className="mb-4 text-lg">MCA Employee Profile</CardTitle>
              <EmployeeProfileForm value={profileForm} onChange={setProfileForm} />
              <div className="mt-6">
                <CardTitle className="mb-4 text-base">Employee Policy Overrides</CardTitle>
                <HrPolicySettingsForm value={employeePolicy} onChange={setEmployeePolicy} />
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => saveStaffProfile(editingStaffId)} disabled={loading}>
                  Save Full Profile
                </Button>
                <Button variant="ghost" onClick={() => setEditingStaffId(null)}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "payroll" && canManageHr && (
        <div className="space-y-6">
          <Card className="border-brand-teal/25 bg-brand-mist/40">
            <CardTitle className="text-lg">Payroll & Salary Slip Creation</CardTitle>
            <p className="mt-1 text-sm text-slate-600">
              Create payroll runs for all staff, mark as processed, then generate individual or bulk salary slip PDFs.
            </p>
          </Card>
          <Card>
            <CardTitle className="mb-4 text-lg">Create Payroll Run</CardTitle>
            <form onSubmit={createPayrollRun} className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Period Start</Label>
                <Input
                  type="date"
                  required
                  value={payrollForm.periodStart}
                  onChange={(e) => setPayrollForm({ ...payrollForm, periodStart: e.target.value })}
                />
              </div>
              <div>
                <Label>Period End</Label>
                <Input
                  type="date"
                  required
                  value={payrollForm.periodEnd}
                  onChange={(e) => setPayrollForm({ ...payrollForm, periodEnd: e.target.value })}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Input
                  value={payrollForm.notes}
                  onChange={(e) => setPayrollForm({ ...payrollForm, notes: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" disabled={loading}>
                  Generate Payroll for All Staff
                </Button>
              </div>
            </form>
          </Card>

          {payrollRuns.map((run) => (
            <Card key={run.id} className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {run.periodStart} — {run.periodEnd}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Status: {PAYROLL_STATUS_LABELS[run.status] ?? run.status}
                  </p>
                </div>
                {run.status !== "PAID" && (
                  <Button size="sm" onClick={() => advancePayrollStatus(run.id)} disabled={loading}>
                    {run.status === "DRAFT" ? "Mark Processed" : "Mark Paid"}
                  </Button>
                )}
                {run.status !== "DRAFT" && (
                  <Button size="sm" variant="secondary" onClick={() => downloadAllSlips(run)} disabled={loading}>
                    <FileText className="mr-1 h-3.5 w-3.5" />
                    Download All Slips
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Employee</th>
                      <th className="px-4 py-3 font-medium">Base</th>
                      <th className="px-4 py-3 font-medium">Deductions</th>
                      <th className="px-4 py-3 font-medium">Bonuses</th>
                      <th className="px-4 py-3 font-medium">Net Pay</th>
                      <th className="px-4 py-3 font-medium">Salary Slip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.lines.map((line) => (
                      <tr key={line.id} className="border-b border-slate-100">
                        <td className="px-4 py-3">
                          <p className="font-medium">{line.userName}</p>
                          <p className="text-xs text-slate-400">{line.department ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3">₹{line.baseSalary.toLocaleString()}</td>
                        <td className="px-4 py-3">₹{line.deductions.toLocaleString()}</td>
                        <td className="px-4 py-3">₹{line.bonuses.toLocaleString()}</td>
                        <td className="px-4 py-3 font-medium">₹{line.netPay.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          {run.status !== "DRAFT" ? (
                            <Button size="sm" variant="ghost" disabled={loading} onClick={() => downloadSlip(line.id)}>
                              <FileText className="mr-1 h-3.5 w-3.5" />
                              PDF
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">Process payroll first</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}

          {payrollRuns.length === 0 && (
            <p className="text-center text-sm text-slate-400">No payroll runs yet</p>
          )}
        </div>
      )}

      {tab === "performance" && (
        <div className="space-y-6">
          {canManageHr && (
          <Card>
            <CardTitle className="mb-4 text-lg">Submit Performance Rating</CardTitle>
            <form onSubmit={submitReview} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Staff Member</Label>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  required
                  value={reviewForm.userId}
                  onChange={(e) => setReviewForm({ ...reviewForm, userId: e.target.value })}
                >
                  <option value="">Select staff...</option>
                  {staff
                    .filter((s) => s.id !== userId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <Label>Review Period</Label>
                <Input
                  required
                  placeholder="e.g. Q1 2026"
                  value={reviewForm.period}
                  onChange={(e) => setReviewForm({ ...reviewForm, period: e.target.value })}
                />
              </div>
              <div>
                <Label>Rating (1–5)</Label>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={reviewForm.rating}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, rating: Number(e.target.value) })
                  }
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} — {RATING_LABELS[n]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Comments</Label>
                <Input
                  value={reviewForm.comments}
                  onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })}
                  placeholder="Optional feedback"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={loading}>
                  Submit Review
                </Button>
              </div>
            </form>
          </Card>
          )}

          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="font-semibold text-slate-900">
                {canManageHr ? "Performance History" : "My Performance Ratings"}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    {canManageHr && <th className="px-4 py-3 font-medium">Employee</th>}
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Rating</th>
                    <th className="px-4 py-3 font-medium">Reviewer</th>
                    <th className="px-4 py-3 font-medium">Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.length === 0 ? (
                    <tr>
                      <td colSpan={canManageHr ? 5 : 4} className="px-4 py-8 text-center text-slate-400">
                        No performance reviews yet
                      </td>
                    </tr>
                  ) : (
                    reviews.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100">
                        {canManageHr && (
                          <td className="px-4 py-3 font-medium">{r.user.name}</td>
                        )}
                        <td className="px-4 py-3">{r.period}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {r.rating} — {RATING_LABELS[r.rating]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{r.reviewer.name}</td>
                        <td className="px-4 py-3 text-slate-500">{r.comments ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "enrollment" && canManageHr && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-brand-teal" />
              <CardTitle className="text-lg">Shareable Enrollment Link</CardTitle>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              Configure payroll, leave, and late-mark settings attached to this enrollment link.
            </p>
            <form onSubmit={createInvite} className="space-y-4">
              <div>
                <Label>Name (optional)</Label>
                <Input
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Email (optional — locks invite to this email)</Label>
                <Input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Role</Label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, role: e.target.value as Role })
                    }
                  >
                    {(["STAFF", "COORDINATOR", "HR", "MANAGER"] as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Expires in (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={inviteForm.expiresInDays}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, expiresInDays: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Department</Label>
                <Input
                  value={inviteForm.department}
                  onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={loading}>
                Generate & Copy Link
              </Button>
            </form>
          </Card>

          <Card className="lg:col-span-2">
            <CardTitle className="mb-4 text-lg">Enrollment Policy Settings</CardTitle>
            <p className="mb-4 text-sm text-slate-500">
              These settings are saved with the invite and applied when the employee enrolls.
            </p>
            <HrPolicySettingsForm value={invitePolicy} onChange={setInvitePolicy} />
          </Card>

          <Card className="lg:col-span-2">
            <CardTitle className="mb-4 text-lg">Pre-fill Employee Profile (optional)</CardTitle>
            <p className="mb-4 text-sm text-slate-500">
              HR can pre-set designation, salary structure, and employment details before sharing the link.
            </p>
            <EmployeeProfileForm value={invitePreset} onChange={setInvitePreset} />
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <LogIn className="h-5 w-5 text-brand-teal" />
              <CardTitle className="text-lg">Create Login Directly</CardTitle>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              Create a staff account with login credentials immediately.
            </p>
            <form onSubmit={createLogin} className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  required
                  value={loginForm.name}
                  onChange={(e) => setLoginForm({ ...loginForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Role</Label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={loginForm.role}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, role: e.target.value as Role })
                    }
                  >
                    {(["STAFF", "COORDINATOR", "HR", "MANAGER"] as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={loginForm.phone}
                    onChange={(e) => setLoginForm({ ...loginForm, phone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Department</Label>
                <Input
                  value={loginForm.department}
                  onChange={(e) => setLoginForm({ ...loginForm, department: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={loading}>
                Create Staff Login
              </Button>
            </form>
          </Card>

          <Card className="overflow-hidden p-0 lg:col-span-2">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Recent Enrollment Links</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Invitee</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Expires</th>
                    <th className="px-4 py-3 font-medium">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No enrollment links yet
                      </td>
                    </tr>
                  ) : (
                    invites.map((inv) => (
                      <tr key={inv.id} className="border-b border-slate-100">
                        <td className="px-4 py-3">
                          <p className="font-medium">{inv.name ?? inv.email ?? "Open invite"}</p>
                          {inv.email && inv.name && (
                            <p className="text-xs text-slate-400">{inv.email}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge role={inv.role} />
                        </td>
                        <td className="px-4 py-3">
                          {inv.isUsed ? (
                            <span className="text-brand-teal">Used</span>
                          ) : inv.isExpired ? (
                            <span className="text-red-500">Expired</span>
                          ) : (
                            <span className="text-amber-600">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {!inv.isUsed && !inv.isExpired && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                copyLink(
                                  inv.shareUrl ||
                                    `${window.location.origin}/enroll/${inv.token}`
                                )
                              }
                            >
                              <Copy className="mr-1 h-3.5 w-3.5" />
                              Copy
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "settings" && canManageHr && (
        <Card>
          <CardTitle className="mb-2 text-lg">Organization HR Policy Defaults</CardTitle>
          <p className="mb-6 text-sm text-slate-500">
            Default payroll, leave, and late-mark rules applied to new enrollments unless overridden per invite or employee.
          </p>
          <HrPolicySettingsForm value={orgPolicy} onChange={setOrgPolicy} />
          <div className="mt-6">
            <Button onClick={saveOrgSettings} disabled={loading}>
              Save Organization Settings
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
