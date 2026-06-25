"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Role } from "@/generated/prisma/enums";
import { EmployeeProfileForm, HrPolicySettingsForm } from "@/components/hr/HrForms";
import { DEFAULT_HR_POLICY, HrPolicyBundle, McaEmployeeProfile } from "@/lib/hr-types";
import { cn } from "@/lib/utils";

interface EnrollPageProps {
  token: string;
}

type EnrollStep = "account" | "profile" | "policy" | "review";

const STEPS: { id: EnrollStep; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "profile", label: "MCA Profile" },
  { id: "policy", label: "Your Settings" },
  { id: "review", label: "Review" },
];

export default function EnrollClient({ token }: EnrollPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<EnrollStep>("account");
  const [invite, setInvite] = useState<{
    email: string | null;
    name: string | null;
    role: Role;
    department: string | null;
    policy: HrPolicyBundle;
    employeePreset: McaEmployeeProfile | null;
  } | null>(null);

  const [account, setAccount] = useState({ name: "", email: "", password: "", phone: "" });
  const [profile, setProfile] = useState<McaEmployeeProfile>({});

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/hr/enrollment/${token}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Invalid invite");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setInvite(data.invite);
      setAccount((a) => ({
        ...a,
        name: data.invite.name ?? "",
        email: data.invite.email ?? "",
      }));
      setProfile({
        ...data.invite.employeePreset,
        department: data.invite.employeePreset?.department ?? data.invite.department ?? "",
        joinDate: data.invite.employeePreset?.joinDate ?? new Date().toISOString().slice(0, 10),
      });
      setLoading(false);
    }
    load();
  }, [token]);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/hr/enrollment/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...account, profile }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Enrollment failed");
      return;
    }

    router.push("/login?enrolled=1");
  }

  const policy = invite?.policy ?? DEFAULT_HR_POLICY;
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  function nextStep() {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  }

  function prevStep() {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading invite...</p>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md text-center">
          <CardTitle className="text-xl text-red-600">Invite Unavailable</CardTitle>
          <p className="mt-3 text-sm text-slate-500">{error}</p>
          <Button className="mt-6" onClick={() => router.push("/login")}>Go to Login</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-3xl">
        <Card className="shadow-xl">
          <div className="mb-6 text-center">
            <CardTitle className="text-2xl">Staff Enrollment — MCA Profile</CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              Complete your employee register as per MCA standards
            </p>
            {invite && (
              <div className="mt-3 flex justify-center gap-2">
                <Badge role={invite.role} />
                {invite.department && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {invite.department}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="mb-8 flex justify-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium",
                    step === s.id
                      ? "bg-brand-red text-white"
                      : i < stepIndex
                        ? "bg-brand-mist text-brand-teal-dark"
                        : "bg-slate-100 text-slate-400"
                  )}
                >
                  {i + 1}
                </div>
                <span className={cn("hidden text-sm sm:inline", step === s.id ? "font-medium text-slate-900" : "text-slate-400")}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <div className="mx-1 hidden h-px w-6 bg-slate-200 sm:block" />}
              </div>
            ))}
          </div>

          {step === "account" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" required value={account.name}
                  onChange={(e) => setAccount({ ...account, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" required readOnly={!!invite?.email}
                  value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="phone">Mobile *</Label>
                <Input id="phone" required value={account.phone}
                  onChange={(e) => setAccount({ ...account, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="password">Create Password *</Label>
                <Input id="password" type="password" required minLength={8}
                  value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })}
                  placeholder="Minimum 8 characters" />
              </div>
            </div>
          )}

          {step === "profile" && (
            <EmployeeProfileForm value={profile} onChange={setProfile} showSalary={false} />
          )}

          {step === "policy" && (
            <div>
              <p className="mb-4 text-sm text-slate-500">
                These payroll, leave, and late-mark settings were configured by HR for your role.
              </p>
              <HrPolicySettingsForm value={policy} onChange={() => {}} readOnly />
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-900">Account</h3>
                <p className="text-slate-600">{account.name} · {account.email} · {account.phone}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-900">Employment</h3>
                <p className="text-slate-600">
                  {profile.designation ?? "—"} · {profile.department ?? invite?.department ?? "—"} · {profile.employmentType ?? "PERMANENT"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-900">Statutory</h3>
                <p className="text-slate-600">
                  PAN: {profile.panNumber ?? "—"} · Aadhaar: {profile.aadhaarNumber ? "****" + profile.aadhaarNumber.slice(-4) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-900">Leave Quota</h3>
                <p className="text-slate-600">
                  CL: {policy.leave.casualLeaveDays} · SL: {policy.leave.sickLeaveDays} · EL: {policy.leave.earnedLeaveDays}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-900">Office Timings</h3>
                <p className="text-slate-600">
                  {policy.lateMark.officeStartTime} – {policy.lateMark.officeEndTime} · Grace: {policy.lateMark.gracePeriodMins} mins
                </p>
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-8 flex justify-between gap-3">
            <Button variant="ghost" onClick={prevStep} disabled={stepIndex === 0}>
              Back
            </Button>
            {step !== "review" ? (
              <Button onClick={nextStep}>Continue</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting..." : "Complete Enrollment"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
