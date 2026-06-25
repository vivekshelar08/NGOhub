"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { PageHeader, PageShell } from "@/components/ui/PageHeader";
import type { OrgSettingsData } from "@/lib/orgSettings";

export function OrgSettingsView() {
  const [settings, setSettings] = useState<OrgSettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/org-settings");
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/org-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("Settings saved. Receipts and UC exports will use these details.");
      load();
    } else {
      setMessage("Failed to save settings.");
    }
  }

  async function sendComplianceReminders() {
    setReminding(true);
    const res = await fetch("/api/notifications/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "compliance_reminders" }),
    });
    setReminding(false);
    if (res.ok) {
      const data = await res.json();
      setMessage(`Queued ${data.queued ?? 0} reminders. Sent ${data.sent ?? 0}.`);
    }
  }

  if (!settings) {
    return (
      <PageShell>
        <p className="text-sm text-slate-500">Loading…</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Organization settings"
        description="Legal details for receipts, UC exports, and notification channels."
      />

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardTitle className="text-base">Legal & registration</CardTitle>
          <CardDescription className="mb-4">Used on 80G receipts and utilization certificates.</CardDescription>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Organization name</Label>
              <Input value={settings.orgName} onChange={(e) => setSettings({ ...settings, orgName: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input value={settings.orgAddress ?? ""} onChange={(e) => setSettings({ ...settings, orgAddress: e.target.value })} />
            </div>
            <div>
              <Label>PAN</Label>
              <Input value={settings.orgPan ?? ""} onChange={(e) => setSettings({ ...settings, orgPan: e.target.value })} />
            </div>
            <div>
              <Label>80G registration</Label>
              <Input value={settings.org80G ?? ""} onChange={(e) => setSettings({ ...settings, org80G: e.target.value })} />
            </div>
            <div>
              <Label>12A registration</Label>
              <Input value={settings.org12A ?? ""} onChange={(e) => setSettings({ ...settings, org12A: e.target.value })} />
            </div>
            <div>
              <Label>FCRA registration</Label>
              <Input value={settings.orgFcra ?? ""} onChange={(e) => setSettings({ ...settings, orgFcra: e.target.value })} />
            </div>
            <div>
              <Label>Contact email</Label>
              <Input type="email" value={settings.orgEmail ?? ""} onChange={(e) => setSettings({ ...settings, orgEmail: e.target.value })} />
            </div>
            <div>
              <Label>Contact phone</Label>
              <Input value={settings.orgPhone ?? ""} onChange={(e) => setSettings({ ...settings, orgPhone: e.target.value })} />
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle className="text-base">Integrations (optional)</CardTitle>
          <CardDescription className="mb-4">
            Add API keys when ready. SMS/WhatsApp use NOTIFY_SMS_API_KEY env; email uses NOTIFY_EMAIL_WEBHOOK or org email.
          </CardDescription>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>SMS provider</Label>
              <Input value={settings.smsProvider ?? ""} onChange={(e) => setSettings({ ...settings, smsProvider: e.target.value })} placeholder="e.g. MSG91" />
            </div>
            <div>
              <Label>Razorpay key ID</Label>
              <Input value={settings.razorpayKeyId ?? ""} onChange={(e) => setSettings({ ...settings, razorpayKeyId: e.target.value })} />
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="teal" className="gap-1.5" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save settings"}
          </Button>
          <Button type="button" variant="outline" className="gap-1.5" disabled={reminding} onClick={sendComplianceReminders}>
            <Bell className="h-4 w-4" />
            {reminding ? "Sending…" : "Send compliance reminders"}
          </Button>
        </div>

        {message && <p className="text-sm text-brand-teal">{message}</p>}
      </form>
    </PageShell>
  );
}
