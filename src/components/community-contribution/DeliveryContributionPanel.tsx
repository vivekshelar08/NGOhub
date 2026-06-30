"use client";

import { useState } from "react";
import {
  CONTRIBUTION_COLLECTION_LABELS,
  ContributionCollectionStatus,
  formatContributionInr,
} from "@/lib/community-contribution";

interface ContributionSummary {
  id: string;
  amount: number;
  collectionStatus: ContributionCollectionStatus;
  partnerName?: string | null;
  recipientType: string;
}

interface DeliveryContributionPanelProps {
  contribution: ContributionSummary;
  canEdit?: boolean;
  onUpdated?: (status: ContributionCollectionStatus) => void;
}

export function DeliveryContributionPanel({
  contribution,
  canEdit = false,
  onUpdated,
}: DeliveryContributionPanelProps) {
  const [status, setStatus] = useState(contribution.collectionStatus);
  const [saving, setSaving] = useState(false);

  async function updateStatus(next: ContributionCollectionStatus) {
    if (!canEdit || next === status) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/community-contributions/entries/${contribution.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionStatus: next }),
      });
      if (!res.ok) throw new Error("Update failed");
      setStatus(next);
      onUpdated?.(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <p className="font-medium text-slate-800">
        Community contribution: {formatContributionInr(contribution.amount)}
      </p>
      {canEdit ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {(["COLLECTED", "PENDING"] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={saving}
              onClick={() => void updateStatus(s)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                status === s
                  ? s === "COLLECTED"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                  : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {CONTRIBUTION_COLLECTION_LABELS[s]}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-0.5 text-xs text-slate-500">
          Status: {CONTRIBUTION_COLLECTION_LABELS[status]}
        </p>
      )}
    </div>
  );
}
