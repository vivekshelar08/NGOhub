"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { formatRole } from "@/lib/utils";

interface ProfileData {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    department: string | null;
  };
  profile: {
    designation: string | null;
    employeeCode: string | null;
    workLocation: string | null;
    permanentAddress: string | null;
    currentAddress: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    panNumber: string | null;
  } | null;
}

const EMPTY_CHANGES = {
  phone: "",
  permanentAddress: "",
  currentAddress: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  panNumber: "",
};

export function ProfileView() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [changes, setChanges] = useState(EMPTY_CHANGES);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) {
          setData(json);
          setChanges({
            phone: json.user.phone ?? "",
            permanentAddress: json.profile?.permanentAddress ?? "",
            currentAddress: json.profile?.currentAddress ?? "",
            emergencyContactName: json.profile?.emergencyContactName ?? "",
            emergencyContactPhone: json.profile?.emergencyContactPhone ?? "",
            panNumber: json.profile?.panNumber ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function submitChangeRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const payload: Record<string, string> = {};
    if (changes.phone.trim() && changes.phone !== (data?.user.phone ?? "")) {
      payload.phone = changes.phone.trim();
    }
    if (
      changes.permanentAddress.trim() &&
      changes.permanentAddress !== (data?.profile?.permanentAddress ?? "")
    ) {
      payload.permanentAddress = changes.permanentAddress.trim();
    }
    if (
      changes.currentAddress.trim() &&
      changes.currentAddress !== (data?.profile?.currentAddress ?? "")
    ) {
      payload.currentAddress = changes.currentAddress.trim();
    }
    if (
      changes.emergencyContactName.trim() &&
      changes.emergencyContactName !== (data?.profile?.emergencyContactName ?? "")
    ) {
      payload.emergencyContactName = changes.emergencyContactName.trim();
    }
    if (
      changes.emergencyContactPhone.trim() &&
      changes.emergencyContactPhone !== (data?.profile?.emergencyContactPhone ?? "")
    ) {
      payload.emergencyContactPhone = changes.emergencyContactPhone.trim();
    }
    if (changes.panNumber.trim() && changes.panNumber !== (data?.profile?.panNumber ?? "")) {
      payload.panNumber = changes.panNumber.trim();
    }

    if (Object.keys(payload).length === 0) {
      setMessage({ text: "Update at least one field before submitting.", error: true });
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/profile/change-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes: payload, reason: reason.trim() || undefined }),
    });
    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setMessage({ text: json.error ?? "Could not submit request", error: true });
      return;
    }

    setMessage({
      text: "Change request sent to HR. Your profile will update after review.",
    });
    setReason("");
  }

  if (loading) {
    return <p className="p-6 text-sm text-slate-500">Loading profile…</p>;
  }

  if (!data) {
    return <p className="p-6 text-sm text-red-600">Could not load profile.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-mist text-brand-teal-dark">
          <User className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{data.user.name}</h1>
          <p className="text-sm text-slate-500">
            {data.profile?.designation ?? formatRole(data.user.role as never)}
            {data.user.department ? ` · ${data.user.department}` : ""}
          </p>
          <p className="text-xs text-slate-400">{data.user.email}</p>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.error ? "bg-red-50 text-red-700" : "bg-brand-mist text-brand-teal-dark"
          }`}
        >
          {message.text}
        </div>
      )}

      <Card className="p-5">
        <CardTitle className="text-base">Official details</CardTitle>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Employee code</dt>
            <dd className="font-medium text-slate-900">{data.profile?.employeeCode ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Work location</dt>
            <dd className="font-medium text-slate-900">{data.profile?.workLocation ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-5">
        <CardTitle className="text-base">Request personal data changes</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          Submit corrections for HR to review. Name and email are managed by your administrator.
        </p>
        <form onSubmit={submitChangeRequest} className="mt-4 space-y-4">
          <div>
            <Label>Phone</Label>
            <Input
              className="mt-1.5"
              value={changes.phone}
              onChange={(e) => setChanges({ ...changes, phone: e.target.value })}
            />
          </div>
          <div>
            <Label>Permanent address</Label>
            <textarea
              className="input-brand mt-1.5 resize-y"
              rows={2}
              value={changes.permanentAddress}
              onChange={(e) => setChanges({ ...changes, permanentAddress: e.target.value })}
            />
          </div>
          <div>
            <Label>Current address</Label>
            <textarea
              className="input-brand mt-1.5 resize-y"
              rows={2}
              value={changes.currentAddress}
              onChange={(e) => setChanges({ ...changes, currentAddress: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Emergency contact name</Label>
              <Input
                className="mt-1.5"
                value={changes.emergencyContactName}
                onChange={(e) =>
                  setChanges({ ...changes, emergencyContactName: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Emergency contact phone</Label>
              <Input
                className="mt-1.5"
                value={changes.emergencyContactPhone}
                onChange={(e) =>
                  setChanges({ ...changes, emergencyContactPhone: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <Label>PAN number</Label>
            <Input
              className="mt-1.5"
              value={changes.panNumber}
              onChange={(e) => setChanges({ ...changes, panNumber: e.target.value })}
            />
          </div>
          <div>
            <Label>Reason for change (optional)</Label>
            <textarea
              className="input-brand mt-1.5 resize-y"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Moved to new address, updated phone number…"
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit change request to HR"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
