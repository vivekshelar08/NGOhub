"use client";

import { useEffect, useState } from "react";
import {
  COMMUNITY_CONTRIBUTION_FIELD_HINT,
  CONTRIBUTION_COLLECTION_LABELS,
  CONTRIBUTION_RECIPIENT_LABELS,
  ContributionCollectionStatus,
  CommunityContributionRuleDto,
  formatContributionInr,
  parseApiResponse,
  resolveContributionRule,
} from "@/lib/community-contribution-shared";

interface CommunityContributionFieldsProps {
  projectId?: string;
  serviceId?: string;
  /** Beneficiary village / centre — matches manager-configured location rates. */
  location?: string;
  value: ContributionCollectionStatus;
  onChange: (status: ContributionCollectionStatus) => void;
  /** Pre-loaded rules map (serviceId → rule). If omitted, fetches when projectId set. */
  rulesByService?: Record<string, CommunityContributionRuleDto>;
  className?: string;
}

export function CommunityContributionFields({
  projectId,
  serviceId,
  location,
  value,
  onChange,
  rulesByService,
  className,
}: CommunityContributionFieldsProps) {
  const [ruleList, setRuleList] = useState<CommunityContributionRuleDto[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);

  useEffect(() => {
    if (rulesByService) {
      setRuleList(Object.values(rulesByService));
      return;
    }
    if (!projectId) {
      setRuleList([]);
      return;
    }
    let cancelled = false;
    setRulesLoading(true);
    void fetch(`/api/community-contributions/rules?projectId=${encodeURIComponent(projectId)}`)
      .then((res) => parseApiResponse(res))
      .then((data) => {
        if (cancelled) return;
        setRuleList((data.rules as CommunityContributionRuleDto[] | undefined) ?? []);
      })
      .catch(() => {
        if (!cancelled) setRuleList([]);
      })
      .finally(() => {
        if (!cancelled) setRulesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, rulesByService]);

  if (!serviceId) return null;

  const rule =
    rulesByService?.[serviceId] ?? resolveContributionRule(ruleList, serviceId, location);
  const hasRate = Boolean(rule && rule.amountPerBeneficiary > 0);

  const recipientLabel =
    rule && rule.recipientType === "PARTNER"
      ? rule.partnerName || CONTRIBUTION_RECIPIENT_LABELS.PARTNER
      : CONTRIBUTION_RECIPIENT_LABELS.NGO;

  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 p-3 ${className ?? ""}`}>
      <p className="text-sm font-medium text-slate-800">Community contribution — paid?</p>
      <p className="mt-0.5 text-xs text-slate-500">{COMMUNITY_CONTRIBUTION_FIELD_HINT}</p>

      {rulesLoading ? (
        <p className="mt-2 text-xs text-slate-500">Loading rate…</p>
      ) : hasRate ? (
        <p className="mt-2 text-sm text-slate-700">
          Amount: <strong>{formatContributionInr(rule!.amountPerBeneficiary)}</strong>
          <span className="text-slate-500"> · Routed to {recipientLabel}</span>
        </p>
      ) : (
        <p className="mt-2 text-xs text-amber-800">
          No rate configured for this service/location yet — manager can set it in Service Portal.
          You can still mark whether the beneficiary paid.
        </p>
      )}

      <fieldset className="mt-3">
        <legend className="mb-2 text-xs font-medium text-slate-600">
          Did the beneficiary pay the community contribution?
        </legend>
        <div className="flex flex-wrap gap-2">
          {(["COLLECTED", "PENDING"] as const).map((status) => (
            <label
              key={status}
              className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
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
