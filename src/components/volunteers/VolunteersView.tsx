"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { PageHeader, PageShell } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";

interface VolunteerHour {
  id: string;
  hours: number;
  activityDate: string;
  notes: string | null;
}

interface Volunteer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  skills: string | null;
  location: string | null;
  totalHours: number;
  logCount: number;
  recentHours: VolunteerHour[];
}

type Tab = "list" | "add" | "hours";

export function VolunteersView() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("list");
  const [flash, setFlash] = useState<{ msg: string; error?: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [addForm, setAddForm] = useState({
    name: "",
    phone: "",
    email: "",
    skills: "",
    location: "",
  });

  const [hoursForm, setHoursForm] = useState({
    volunteerId: "",
    hours: "",
    activityDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/volunteers");
    if (res.ok) {
      const data = await res.json();
      setVolunteers(data.volunteers ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function onFlash(msg: string, error?: boolean) {
    setFlash({ msg, error });
    setTimeout(() => setFlash(null), 4000);
  }

  async function handleAddVolunteer(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim()) {
      onFlash("Name is required.", true);
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/volunteers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: addForm.name.trim(),
        phone: addForm.phone || undefined,
        email: addForm.email || undefined,
        skills: addForm.skills || undefined,
        location: addForm.location || undefined,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      onFlash("Volunteer added.");
      setAddForm({ name: "", phone: "", email: "", skills: "", location: "" });
      setTab("list");
      load();
    } else {
      onFlash("Failed to add volunteer.", true);
    }
  }

  async function handleLogHours(e: React.FormEvent) {
    e.preventDefault();
    const hours = parseFloat(hoursForm.hours);
    if (!hoursForm.volunteerId || !hours || hours <= 0) {
      onFlash("Select a volunteer and enter valid hours.", true);
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/volunteers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "log_hours",
        volunteerId: hoursForm.volunteerId,
        hours,
        activityDate: hoursForm.activityDate,
        notes: hoursForm.notes || undefined,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      onFlash("Hours logged.");
      setHoursForm((f) => ({ ...f, hours: "", notes: "" }));
      setTab("list");
      load();
    } else {
      onFlash("Failed to log hours.", true);
    }
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "list", label: "Volunteers", icon: null },
    { id: "add", label: "Add volunteer", icon: <UserPlus className="h-4 w-4" /> },
    { id: "hours", label: "Log hours", icon: <Clock className="h-4 w-4" /> },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="People"
        title="Volunteers"
        description="Register volunteers and log their contribution hours."
      />

      {flash && (
        <div
          className={cn(
            "mb-4 rounded-lg px-4 py-3 text-sm font-medium",
            flash.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          )}
        >
          {flash.msg}
        </div>
      )}

      <div className="tab-bar-mobile mb-6 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] sm:px-4",
              tab === t.id
                ? "border-brand-teal text-brand-teal"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "list" && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading volunteers…</p>
          ) : volunteers.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500">No volunteers registered yet.</p>
            </Card>
          ) : (
            volunteers.map((v) => (
              <Card key={v.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{v.name}</CardTitle>
                    <CardDescription>
                      {[v.location, v.skills].filter(Boolean).join(" · ") || "No details"}
                    </CardDescription>
                    {(v.phone || v.email) && (
                      <p className="mt-1 text-sm text-slate-500">
                        {[v.phone, v.email].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums text-brand-teal">
                      {v.totalHours.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
                    </p>
                    <p className="text-xs text-slate-500">total hours · {v.logCount} logs</p>
                  </div>
                </div>

                {v.recentHours.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Recent logs
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {v.recentHours.map((h) => (
                        <li key={h.id} className="flex justify-between gap-2 text-slate-600">
                          <span>
                            {new Date(h.activityDate).toLocaleDateString("en-IN")}
                            {h.notes && <span className="text-slate-400"> — {h.notes}</span>}
                          </span>
                          <span className="font-medium tabular-nums">{h.hours}h</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "add" && (
        <Card>
          <CardTitle>Add volunteer</CardTitle>
          <form onSubmit={handleAddVolunteer} className="mt-4 space-y-4">
            <div>
              <Label htmlFor="vol-name">Name *</Label>
              <Input
                id="vol-name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="vol-phone">Phone</Label>
                <Input
                  id="vol-phone"
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="vol-email">Email</Label>
                <Input
                  id="vol-email"
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="vol-skills">Skills</Label>
                <Input
                  id="vol-skills"
                  value={addForm.skills}
                  onChange={(e) => setAddForm((f) => ({ ...f, skills: e.target.value }))}
                  placeholder="Teaching, data entry…"
                />
              </div>
              <div>
                <Label htmlFor="vol-location">Location</Label>
                <Input
                  id="vol-location"
                  value={addForm.location}
                  onChange={(e) => setAddForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Add volunteer"}
            </Button>
          </form>
        </Card>
      )}

      {tab === "hours" && (
        <Card>
          <CardTitle>Log volunteer hours</CardTitle>
          <form onSubmit={handleLogHours} className="mt-4 space-y-4">
            <div>
              <Label htmlFor="hours-volunteer">Volunteer *</Label>
              <select
                id="hours-volunteer"
                className="input-brand w-full"
                value={hoursForm.volunteerId}
                onChange={(e) => setHoursForm((f) => ({ ...f, volunteerId: e.target.value }))}
                required
              >
                <option value="">Select volunteer</option>
                {volunteers.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="hours-amount">Hours *</Label>
                <Input
                  id="hours-amount"
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={hoursForm.hours}
                  onChange={(e) => setHoursForm((f) => ({ ...f, hours: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="hours-date">Activity date *</Label>
                <Input
                  id="hours-date"
                  type="date"
                  value={hoursForm.activityDate}
                  onChange={(e) => setHoursForm((f) => ({ ...f, activityDate: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="hours-notes">Notes</Label>
              <Textarea
                id="hours-notes"
                value={hoursForm.notes}
                onChange={(e) => setHoursForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <Button type="submit" disabled={submitting || volunteers.length === 0}>
              {submitting ? "Saving…" : "Log hours"}
            </Button>
          </form>
        </Card>
      )}
    </PageShell>
  );
}
