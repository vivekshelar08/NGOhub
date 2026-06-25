"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { HelpTip } from "@/components/ui/HelpTip";
import { cn } from "@/lib/utils";

interface FeedbackItem {
  id: string;
  type: string;
  rating: number | null;
  note: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  createdBy: { name: string };
}

interface BeneficiaryFeedbackSectionProps {
  beneficiaryId: string;
  onFlash?: (msg: string, error?: boolean) => void;
}

export function BeneficiaryFeedbackSection({ beneficiaryId, onFlash }: BeneficiaryFeedbackSectionProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"FEEDBACK" | "COMPLAINT" | "SATISFACTION">("FEEDBACK");
  const [note, setNote] = useState("");
  const [rating, setRating] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/beneficiary-feedback?beneficiaryId=${beneficiaryId}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.feedback ?? []);
    }
  }, [beneficiaryId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/beneficiary-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId,
          type,
          note: note.trim(),
          rating: rating ? Number(rating) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setNote("");
      setRating("");
      onFlash?.("Feedback recorded");
      await load();
    } catch {
      onFlash?.("Could not save feedback", true);
    } finally {
      setLoading(false);
    }
  }

  async function resolve(id: string) {
    setLoading(true);
    try {
      await fetch("/api/beneficiary-feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "RESOLVED", resolution: "Addressed by team" }),
      });
      await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardTitle className="mb-3 flex items-center gap-2 text-base">
        Feedback & complaints
        <HelpTip helpKey="follow_up" />
      </CardTitle>

      <form onSubmit={submit} className="mb-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Type</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="FEEDBACK">General feedback</option>
              <option value="COMPLAINT">Complaint</option>
              <option value="SATISFACTION">Satisfaction rating</option>
            </Select>
          </div>
          {type === "SATISFACTION" && (
            <div>
              <Label>Rating (1–5)</Label>
              <Select value={rating} onChange={(e) => setRating(e.target.value)}>
                <option value="">Select</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </div>
          )}
        </div>
        <div>
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did they share?" />
        </div>
        <Button type="submit" size="sm" disabled={loading || !note.trim()}>
          Save feedback
        </Button>
      </form>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-slate-500">No feedback yet.</p>}
        {items.map((f) => (
          <div key={f.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium capitalize">{f.type.toLowerCase()}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  f.status === "OPEN" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                )}
              >
                {f.status.replace("_", " ")}
              </span>
            </div>
            <p className="mt-1 text-slate-700">{f.note}</p>
            {f.rating != null && <p className="text-xs text-slate-500">Rating: {f.rating}/5</p>}
            <p className="mt-1 text-xs text-slate-500">
              {f.createdBy.name} · {new Date(f.createdAt).toLocaleDateString("en-IN")}
            </p>
            {f.status === "OPEN" && (
              <Button type="button" size="sm" variant="secondary" className="mt-2" disabled={loading} onClick={() => resolve(f.id)}>
                Mark resolved
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
