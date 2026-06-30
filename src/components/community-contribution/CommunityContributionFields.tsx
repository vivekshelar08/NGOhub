"use client";

import { useEffect, useState } from "react";
import {
  COMMUNITY_CONTRIBUTION_FIELD_HINT,
  CONTRIBUTION_COLLECTION_LABELS,
  CONTRIBUTION_RECIPIENT_LABELS,
  ContributionCollectionStatus,
  CommunityContributionRuleDto,
  formatContributionInr,
} from "@/lib/community-contribution";

interface CommunityContributionFieldsProps {
  projectId?: string;
  serviceId?: string;
  value: ContributionCollectionStatus;
  onChange: (status: ContributionCollectionStatus) => void;
  /** Pre-loaded rules map (serviceId → rule). If omitted, fetches when projectId set. */
  rulesByService?: Record<string, CommunityContributionRuleDto>;
  className?: string;
}

export function CommunityContributionFields({
  projectId,
  serviceId,
  value,
  onChange,
  rulesByService,
  className,
}: CommunityContributionFieldsProps) {
  const [rules, setRules] = useState<Record<string, CommunityContributionRuleDto>>(
    rulesByService ?? {}
  );

  useEffect(() => {
    if (rulesByService) {
      setRules(rulesByService);
      return;
    }
    if (!projectId) {
      setRules({});
      return;
    }
    let cancelled = false;
    void fetch(`/api/community-contributions/rules?projectId=${encodeURIComponent(projectId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const map: Record<string, CommunityContributionRuleDto> = {};
        for (const rule of data.rules ?? []) {
          map[rule.serviceId] = rule;
        }
        setRules(map);
      })
      .catch(() => {
        if (!cancelled) setRules({});
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, rulesByService]);

  if (!serviceId) return null;

  const rule = rules[serviceId];
  if (!rule || rule.amountPerBeneficiary <= 0) return null;

  const recipientLabel =
    rule.recipientType === "PARTNER"
      ? rule.partnerName || CONTRIBUTION_RECIPIENT_LABELS.PARTNER
      : CONTRIBUTION_RECIPIENT_LABELS.NGO;

  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 p-3 ${className ?? ""}`}>
      <p className="text-sm font-medium text-slate-800">Community contribution</p>
      <p className="mt-0.5 text-xs text-slate-500">{COMMUNITY_CONTRIBUTION_FIELD_HINT}</p>
      <p className="mt-2 text-sm text-slate-700">
        Amount: <strong>{formatContributionInr(rule.amountPerBeneficiary)}</strong>
        <span className="text-slate-500"> · Routed to {recipientLabel}</span>
      </p>
      <fieldset className="mt-3">
        <legend className="sr-only">Contribution collection status</legend>
        <div className="flex flex-wrap gap-2">
          {(["COLLECTED", "PENDING"] as const).map((status) => (
            <label
              key={status}
              className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                value === status
                  ? status === "COLLECTED"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "border-amber-400 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name={`cc-status-${serviceId}`}
                className="sr-only"
                checked={value === status}
                onChange={() => onChange(status)}
              />
              {CONTRIBUTION_COLLECTION_LABELS[status]}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
