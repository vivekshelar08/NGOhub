"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import {
  CONTRIBUTION_RECIPIENT_LABELS,
  CommunityContributionRuleDto,
  formatContributionInr,
  parseApiResponse,
} from "@/lib/community-contribution-shared";

interface ServiceOption {
  id: string;
  name: string;
}

interface CommunityContributionRulesConfigProps {
  projectId: string;
  projectTitle?: string;
  /** Places from the project (district, centre, coverage areas). */
  projectLocations: string[];
  services: ServiceOption[];
}

type DraftRow = {
  amount: string;
  recipientType: "NGO" | "PARTNER";
  partnerName: string;
};

function draftKey(location: string, serviceId: string) {
  return `${location}::${serviceId}`;
}

export function CommunityContributionRulesConfig({
  projectId,
  projectTitle,
  projectLocations,
  services,
}: CommunityContributionRulesConfigProps) {
  const [selectedLocation, setSelectedLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [rules, setRules] = useState<CommunityContributionRuleDto[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const activeLocation = useMemo(() => {
    if (selectedLocation === "__custom__") return customLocation.trim();
    return selectedLocation;
  }, [selectedLocation, customLocation]);

  useEffect(() => {
    if (projectLocations.length > 0 && !selectedLocation) {
      setSelectedLocation(projectLocations[0]);
    }
  }, [projectLocations, selectedLocation]);

  const load = useCallback(async () => {
    if (!projectId || !activeLocation) {
      setRules([]);
      setDrafts({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId, location: activeLocation });
      const res = await fetch(`/api/community-contributions/rules?${params}`);
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(String(data.error ?? "Failed to load rates"));
      const loaded: CommunityContributionRuleDto[] =
        (data.rules as CommunityContributionRuleDto[] | undefined) ?? [];
      setRules(loaded);
      const next: Record<string, DraftRow> = {};
      for (const svc of services) {
        const rule = loaded.find((r) => r.serviceId === svc.id && r.location === activeLocation);
        const key = draftKey(activeLocation, svc.id);
        next[key] = {
          amount: rule ? String(rule.amountPerBeneficiary) : "",
          recipientType: rule?.recipientType ?? "NGO",
          partnerName: rule?.partnerName ?? "",
        };
      }
      setDrafts(next);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load rates");
    } finally {
      setLoading(false);
    }
  }, [projectId, activeLocation, services]);

  useEffect(() => {
    if (projectId && services.length > 0 && activeLocation) void load();
  }, [projectId, services, activeLocation, load]);

  async function save(serviceId: string) {
    const key = draftKey(activeLocation, serviceId);
    const draft = drafts[key];
    if (!activeLocation) {
      setMessage("Select a project location first.");
      return;
    }
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
          location: activeLocation,
          amountPerBeneficiary: Number(draft.amount),
          recipientType: draft.recipientType,
          partnerName: draft.partnerName.trim() || undefined,
        }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(String(data.error ?? "Failed to save"));
      const rule = data.rule as CommunityContributionRuleDto | undefined;
      setMessage(`Saved rate for ${rule?.serviceName ?? "service"} at ${activeLocation}.`);
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
          Select a project above — managers set community contribution rates here by project
          location and service (not in milestone setup).
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle className="mb-1 text-base">Community contribution rates</CardTitle>
      <p className="mb-4 text-sm text-slate-500">
        Managers set per-beneficiary amounts for <strong>{projectTitle ?? "this project"}</strong>{" "}
        by <strong>location</strong> and service. Staff mark each entry as{" "}
        <em>Collected</em> or <em>Pending</em> during data entry.
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Project location</Label>
          <select
            className="input-brand mt-1 w-full"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
          >
            {projectLocations.length === 0 && (
              <option value="__custom__">Enter location manually</option>
            )}
            {projectLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
            <option value="__custom__">Other location…</option>
          </select>
        </div>
        {selectedLocation === "__custom__" && (
          <div>
            <Label className="text-xs">Location name</Label>
            <Input
              className="mt-1"
              placeholder="e.g. Ghatkopar centre, Ward 12"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
            />
          </div>
        )}
      </div>

      {!activeLocation && (
        <p className="text-sm text-amber-700">Choose or enter a location to configure rates.</p>
      )}

      {loading && activeLocation && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading rates…
        </div>
      )}

      {!loading && activeLocation && services.length === 0 && (
        <p className="text-sm text-slate-500">Create services first, then set rates here.</p>
      )}

      {!loading && activeLocation && services.length > 0 && (
        <div className="space-y-4">
          {services.map((svc) => {
            const key = draftKey(activeLocation, svc.id);
            const draft = drafts[key] ?? {
              amount: "",
              recipientType: "NGO" as const,
              partnerName: "",
            };
            const saved = rules.find(
              (r) => r.serviceId === svc.id && r.location === activeLocation
            );
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
                        [key]: { ...draft, amount: e.target.value },
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
                        [key]: {
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
                        [key]: { ...draft, partnerName: e.target.value },
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
