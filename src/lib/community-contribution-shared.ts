import {
  CommunityContributionCollectionStatus,
  CommunityContributionRecipientType,
} from "@/generated/prisma/enums";

/** Client-safe types and labels — no database imports. */

export type ContributionCollectionStatus = CommunityContributionCollectionStatus;

export const CONTRIBUTION_COLLECTION_LABELS: Record<ContributionCollectionStatus, string> = {
  COLLECTED: "Paid",
  PENDING: "Not paid",
};

export const CONTRIBUTION_RECIPIENT_LABELS: Record<CommunityContributionRecipientType, string> = {
  NGO: "NGO (direct)",
  PARTNER: "Partner / SHG",
};

export const COMMUNITY_CONTRIBUTION_FIELD_HINT =
  "Community contribution — amount paid by the beneficiary toward the service (not NGO profit).";

export function formatContributionInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Parse API JSON safely — avoids "Unexpected end of JSON input" on empty error bodies. */
export async function parseApiResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Empty response from server"
        : `Server error (${res.status}). Database may need updating — run npx prisma db push on the host.`
    );
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid server response (${res.status})`);
  }
}

export interface CommunityContributionRuleDto {
  id: string;
  projectId: string;
  serviceId: string;
  serviceName?: string;
  location: string;
  amountPerBeneficiary: number;
  recipientType: CommunityContributionRecipientType;
  partnerId: string | null;
  partnerName: string | null;
  isActive: boolean;
}

export interface PeriodContributionSummary {
  collectedCount: number;
  collectedAmount: number;
  pendingCount: number;
  pendingAmount: number;
  totalEntries: number;
  byService: Array<{
    serviceId: string;
    serviceName: string;
    collectedAmount: number;
    pendingAmount: number;
  }>;
  byRecipient: Array<{
    recipientType: CommunityContributionRecipientType;
    partnerName: string | null;
    collectedAmount: number;
    pendingAmount: number;
  }>;
  byMonth: Array<{ month: string; collected: number; pending: number }>;
}

export interface DailyContributionSummary {
  date: string;
  projectId: string | null;
  collectedCount: number;
  collectedAmount: number;
  pendingCount: number;
  pendingAmount: number;
  totalEntries: number;
  byService: Array<{
    serviceId: string;
    serviceName: string;
    collectedCount: number;
    collectedAmount: number;
    pendingCount: number;
    pendingAmount: number;
  }>;
  byRecipient: Array<{
    recipientType: CommunityContributionRecipientType;
    partnerName: string | null;
    collectedAmount: number;
    pendingAmount: number;
  }>;
}

/** Pick location-specific rate, else project-wide default (empty location). */
export function resolveContributionRule(
  rules: CommunityContributionRuleDto[],
  serviceId: string,
  location?: string
): CommunityContributionRuleDto | undefined {
  const loc = location?.trim() ?? "";
  const forService = rules.filter((r) => r.serviceId === serviceId);
  return (
    forService.find((r) => r.location === loc) ??
    (loc ? forService.find((r) => r.location === "") : undefined)
  );
}
