"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import {
  CONTRIBUTION_RECIPIENT_LABELS,
  CommunityContributionRuleDto,
  formatContributionInr,
} from "@/lib/community-contribution-shared";

interface ServiceOption {
  id: string;
  name: string;
}

interface CommunityContributionRulesConfigProps {
  projectId: string;
  projectTitle?: string;
  services: ServiceOption[];
}

type DraftRow = {
  amount: string;
  recipientType: "NGO" | "PARTNER";
  partnerName: string;
};

export function CommunityContributionRulesConfig({
  projectId,
  projectTitle,
  services,
}: CommunityContributionRulesConfigProps) {
  const [rules, setRules] = useState<CommunityContributionRuleDto[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/community-contributions/rules?projectId=${encodeURIComponent(projectId)}`
      );
      const data = await res.json();
      const loaded: CommunityContributionRuleDto[] = data.rules ?? [];
      setRules(loaded);
      const next: Record<string, DraftRow> = {};
      for (const svc of services) {
        const rule = loaded.find((r) => r.serviceId === svc.id);
        next[svc.id] = {
          amount: rule ? String(rule.amountPerBeneficiary) : "",
          recipientType: rule?.recipientType ?? "NGO",
          partnerName: rule?.partnerName ?? "",
        };
      }
      setDrafts(next);
    } finally {
      setLoading(false);
    }
  }, [projectId, services]);

  useEffect(() => {
    if (projectId && services.length > 0) void load();
  }, [projectId, services, load]);

  async function save(serviceId: string) {
    const draft = drafts[serviceId];
    if (!draft?.amount || Number(draft.amount) <= 0) {
      setMessage("Enter a positive amount per beneficiary.");
      return;
    }
    if (draft.recipientType === "PARTNER" && !draft.partnerName.trim()) {
      setMessage("Enter partner / SHG name for partner routing.");
      return;
    }

    setSavingId(serviceId);
    setMessage("");
    try {
      const res = await fetch("/api/community-contributions/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          serviceId,
          amountPerBeneficiary: Number(draft.amount),
          recipientType: draft.recipientType,
          partnerName: draft.partnerName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setMessage(`Saved rate for ${data.rule.serviceName}.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingId(null);
    }
  }

  if (!projectId) {
    return (
      <Card className="p-4">
        <p className="text-sm text-slate-500">
          Select a project above to configure community contribution rates per service.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle className="mb-1 text-base">Community contribution rates</CardTitle>
      <p className="mb-4 text-sm text-slate-500">
        Set the per-beneficiary amount for each service on{" "}
        <strong>{projectTitle ?? "this project"}</strong>. Staff will mark each entry as{" "}
        <em>Collected</em> or <em>Pending</em> during data entry.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading rates…
        </div>
      )}

      {!loading && services.length === 0 && (
        <p className="text-sm text-slate-500">Create services first, then set rates here.</p>
      )}

      {!loading && services.length > 0 && (
        <div className="space-y-4">
          {services.map((svc) => {
            const draft = drafts[svc.id] ?? {
              amount: "",
              recipientType: "NGO" as const,
              partnerName: "",
            };
            const saved = rules.find((r) => r.serviceId === svc.id);
            return (
              <div
                key={svc.id}
                className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-5"
              >
                <div className="sm:col-span-2 lg:col-span-1">
                  <p className="font-medium text-slate-900">{svc.name}</p>
                  {saved && (
                    <p className="text-xs text-emerald-700">
                      Active: {formatContributionInr(saved.amountPerBeneficiary)}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">₹ per beneficiary</Label>
                  <Input
                    type="number"
                    min={1}
                    className="mt-1"
                    placeholder="e.g. 50"
                    value={draft.amount}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [svc.id]: { ...draft, amount: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Goes to</Label>
                  <select
                    className="input-brand mt-1 w-full"
                    value={draft.recipientType}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [svc.id]: {
                          ...draft,
                          recipientType: e.target.value as "NGO" | "PARTNER",
                        },
                      }))
                    }
                  >
                    <option value="NGO">{CONTRIBUTION_RECIPIENT_LABELS.NGO}</option>
                    <option value="PARTNER">{CONTRIBUTION_RECIPIENT_LABELS.PARTNER}</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Partner / SHG name</Label>
                  <Input
                    className="mt-1"
                    disabled={draft.recipientType !== "PARTNER"}
                    placeholder="If routed to SHG"
                    value={draft.partnerName}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [svc.id]: { ...draft, partnerName: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    disabled={savingId === svc.id}
                    onClick={() => void save(svc.id)}
                  >
                    {savingId === svc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
    </Card>
  );
}
