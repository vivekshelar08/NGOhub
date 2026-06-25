"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { HelpTip } from "@/components/ui/HelpTip";
import { Input, Label } from "@/components/ui/Input";
import { PageHeader, PageShell } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { readFileAsDataUrl } from "@/lib/activities";
import {
  COMPLIANCE_STATUS_LABELS,
  COMPLIANCE_TYPE_LABELS,
} from "@/lib/compliance-utils";
import { ComplianceStatus, ComplianceType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

interface ComplianceItem {
  id: string;
  type: ComplianceType;
  title: string;
  description: string | null;
  dueDate: string;
  filedAt: string | null;
  status: ComplianceStatus;
  reminderDays: number;
}

type StatusFilter = "all" | ComplianceStatus;

const STATUS_TONE: Record<ComplianceStatus, "success" | "warning" | "danger" | "info" | "neutral"> = {
  FILED: "success",
  UPCOMING: "info",
  DUE: "warning",
  OVERDUE: "danger",
};

export function ComplianceView() {
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [flash, setFlash] = useState<{ msg: string; error?: boolean } | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/compliance");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
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

  async function handleSeed() {
    setSeeding(true);
    const res = await fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed" }),
    });
    setSeeding(false);
    if (res.ok) {
      const data = await res.json();
      onFlash(data.seeded ? `Seeded ${data.seeded} compliance items.` : data.message ?? "Already seeded.");
      load();
    } else {
      onFlash("Failed to seed compliance items.", true);
    }
  }

  async function markFiled(id: string) {
    const res = await fetch(`/api/compliance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "FILED",
        filedAt: new Date().toISOString(),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setItems((prev) => prev.map((i) => (i.id === id ? data.item : i)));
      onFlash("Marked as filed.");
    } else {
      onFlash("Failed to update item.", true);
    }
  }

  async function handleUpload(itemId: string, file: File) {
    setUploadingId(itemId);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file.name,
          category: "OTHER",
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          dataUrl,
          complianceItemId: itemId,
        }),
      });
      if (!res.ok) throw new Error("Upload failed");
      onFlash("Document uploaded to vault.");
    } catch {
      onFlash("Failed to upload document.", true);
    } finally {
      setUploadingId(null);
    }
  }

  const filtered =
    statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter);

  const tabs: Array<{ id: StatusFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "OVERDUE", label: "Overdue" },
    { id: "DUE", label: "Due soon" },
    { id: "UPCOMING", label: "Upcoming" },
    { id: "FILED", label: "Filed" },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Governance"
        title="Compliance calendar"
        description="Track statutory filings, upload proof documents, and mark items as filed."
        actions={
          <div className="flex items-center gap-2">
            <HelpTip helpKey="compliance" />
            <Button type="button" variant="outline" size="sm" disabled={seeding} onClick={handleSeed}>
              <Plus className="mr-1.5 h-4 w-4" />
              {seeding ? "Seeding…" : "Seed defaults"}
            </Button>
          </div>
        }
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
            onClick={() => setStatusFilter(t.id)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] sm:px-4",
              statusFilter === t.id
                ? "border-brand-teal text-brand-teal"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {t.label}
            {t.id !== "all" && (
              <span className="ml-1.5 text-xs text-slate-400">
                ({items.filter((i) => i.status === t.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading compliance items…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            {items.length === 0
              ? "No compliance items yet. Use “Seed defaults” to add the standard India NGO calendar."
              : "No items match this filter."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <Card key={item.id} className="flex flex-col">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <StatusBadge tone={STATUS_TONE[item.status]}>
                  {COMPLIANCE_STATUS_LABELS[item.status]}
                </StatusBadge>
                <span className="text-xs font-medium text-slate-500">
                  {COMPLIANCE_TYPE_LABELS[item.type]}
                </span>
              </div>

              <CardTitle className="text-base">{item.title}</CardTitle>
              {item.description && (
                <p className="mt-1 text-sm text-slate-500 line-clamp-2">{item.description}</p>
              )}

              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Due date</dt>
                  <dd className="font-medium text-brand-ink">
                    {new Date(item.dueDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </dd>
                </div>
                {item.filedAt && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Filed</dt>
                    <dd className="font-medium text-emerald-700">
                      {new Date(item.filedAt).toLocaleDateString("en-IN")}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {item.status !== "FILED" && (
                  <Button type="button" size="sm" variant="teal" onClick={() => markFiled(item.id)}>
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Mark filed
                  </Button>
                )}
                <Label className="mb-0 cursor-pointer">
                  <span className="sr-only">Upload proof for {item.title}</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-teal bg-white px-3 py-1.5 text-sm font-semibold text-brand-teal transition-colors hover:bg-brand-mist",
                      uploadingId === item.id && "pointer-events-none opacity-50"
                    )}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingId === item.id ? "Uploading…" : "Upload doc"}
                  </span>
                  <Input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    disabled={uploadingId === item.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(item.id, file);
                      e.target.value = "";
                    }}
                  />
                </Label>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
