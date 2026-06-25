"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { Donor, loadDonors } from "@/lib/donors";

const STAGES = [
  "PROSPECT",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "GRANTED",
  "REPORTING",
  "CLOSED",
] as const;

interface PipelineEntry {
  id: string;
  donorId: string;
  donorName: string;
  stage: string;
  nextFollowUp: string | null;
  amountPledged: number | null;
  notes: string | null;
}

interface DonorPipelinePanelProps {
  variant?: "light" | "dark";
}

export function DonorPipelinePanel({ variant = "dark" }: DonorPipelinePanelProps) {
  const isDark = variant === "dark";
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [selectedDonorId, setSelectedDonorId] = useState("");

  const textMuted = isDark ? "text-slate-400" : "text-slate-500";
  const panel = isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white";

  const load = useCallback(async () => {
    const res = await fetch("/api/donor-pipeline");
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries ?? []);
    }
    setDonors(loadDonors());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addToPipeline() {
    const donor = donors.find((d) => d.id === selectedDonorId);
    if (!donor) return;
    await fetch("/api/donor-pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ donorId: donor.id, donorName: donor.name }),
    });
    load();
  }

  async function updateStage(id: string, stage: string) {
    await fetch("/api/donor-pipeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, stage }),
    });
    load();
  }

  const byStage = STAGES.map((stage) => ({
    stage,
    items: entries.filter((e) => e.stage === stage),
  }));

  return (
    <div className="mt-8">
      <h2 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-slate-900")}>
        Donor CRM pipeline
      </h2>
      <p className={cn("mt-1 text-sm", textMuted)}>
        Track prospects from first contact through grant reporting.
      </p>

      <Card className={cn("mt-4", panel)}>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[200px] flex-1">
            <Label className={isDark ? "text-slate-300" : undefined}>Add donor to pipeline</Label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={selectedDonorId}
              onChange={(e) => setSelectedDonorId(e.target.value)}
            >
              <option value="">Select donor…</option>
              {donors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" size="sm" variant="primary" onClick={addToPipeline} disabled={!selectedDonorId}>
              Add
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-3 overflow-x-auto pb-2 md:grid-cols-3 lg:grid-cols-6">
        {byStage.map(({ stage, items }) => (
          <div key={stage} className={cn("min-w-[140px] rounded-xl border p-3", panel)}>
            <CardTitle className="text-xs uppercase tracking-wide text-brand-teal">
              {stage.replace(/_/g, " ")}
            </CardTitle>
            <ul className="mt-2 space-y-2">
              {items.map((e) => (
                <li key={e.id} className="rounded-lg border border-slate-700/30 bg-black/10 p-2 text-sm">
                  <p className="font-medium">{e.donorName}</p>
                  {e.nextFollowUp && (
                    <p className={cn("text-xs", textMuted)}>Follow up: {e.nextFollowUp}</p>
                  )}
                  <select
                    className="mt-1 w-full rounded border px-1 py-0.5 text-xs"
                    value={e.stage}
                    onChange={(ev) => updateStage(e.id, ev.target.value)}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </li>
              ))}
              {items.length === 0 && (
                <li className={cn("text-xs", textMuted)}>—</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
