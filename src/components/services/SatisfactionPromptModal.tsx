"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface SatisfactionPromptModalProps {
  beneficiaryId: string;
  beneficiaryName: string;
  serviceName?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function SatisfactionPromptModal({
  beneficiaryId,
  beneficiaryName,
  serviceName,
  onClose,
  onSubmitted,
}: SatisfactionPromptModalProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/beneficiary-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId,
          type: "SATISFACTION",
          rating,
          note: note.trim() || `Satisfaction after ${serviceName ?? "service"} completion`,
        }),
      });
      if (res.ok) {
        onSubmitted?.();
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">How was the service?</h3>
        <p className="mt-1 text-sm text-slate-600">
          Quick feedback for {beneficiaryName}
          {serviceName ? ` — ${serviceName}` : ""}
        </p>

        <div className="mt-4 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={cn(
                "rounded-full p-2 transition-colors",
                rating === n ? "bg-amber-100 text-amber-600" : "text-slate-300 hover:text-amber-400"
              )}
              aria-label={`${n} stars`}
            >
              <Star className={cn("h-7 w-7", rating != null && n <= rating && "fill-current")} />
            </button>
          ))}
        </div>

        <textarea
          className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          rows={2}
          placeholder="Optional comment…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="mt-4 flex gap-2">
          <Button type="button" variant="teal" disabled={!rating || submitting} onClick={handleSubmit}>
            {submitting ? "Saving…" : "Submit feedback"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}
