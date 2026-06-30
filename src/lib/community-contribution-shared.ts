import {
  CommunityContributionCollectionStatus,
  CommunityContributionRecipientType,
} from "@/generated/prisma/enums";

/** Client-safe types and labels — no database imports. */

export type ContributionCollectionStatus = CommunityContributionCollectionStatus;

export const CONTRIBUTION_COLLECTION_LABELS: Record<ContributionCollectionStatus, string> = {
  COLLECTED: "Collected",
  PENDING: "Pending",
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

export interface CommunityContributionRuleDto {
  id: string;
  projectId: string;
  serviceId: string;
  serviceName?: string;
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
