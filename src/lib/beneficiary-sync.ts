import { BeneficiaryEntry } from "@/lib/activities";
import { BeneficiaryCategory } from "@/generated/prisma/enums";

export interface SyncBeneficiaryOptions {
  projectId: string;
  requireService?: boolean;
}

export interface SyncBeneficiaryResult {
  beneficiaries: BeneficiaryEntry[];
  created: number;
  linked: number;
  servicesAdded: number;
}

function toCategory(raw?: string): BeneficiaryCategory {
  const valid: BeneficiaryCategory[] = ["GENERAL", "SC", "ST", "OBC", "EWS", "OTHER"];
  if (raw && valid.includes(raw as BeneficiaryCategory)) {
    return raw as BeneficiaryCategory;
  }
  return "GENERAL";
}

function portalPayload(entry: BeneficiaryEntry, projectId: string) {
  return {
    name: entry.name.trim(),
    mobile: entry.contact?.trim() || undefined,
    age: entry.age,
    gender: entry.gender || undefined,
    address: entry.address || undefined,
    location: entry.location || undefined,
    category: toCategory(entry.category),
    cohorts: entry.cohorts?.length ? entry.cohorts : undefined,
    monthlyIncome:
      entry.annualIncome != null ? Math.round(entry.annualIncome / 12) : undefined,
    familyMembers: entry.familyMembers,
    notes: entry.notes || undefined,
    isUrgentCase: entry.isUrgentCase ?? false,
    isCaseStudy: entry.isCaseStudy ?? false,
    projectId,
    serviceId: entry.serviceId || undefined,
    contributionCollectionStatus: entry.contributionCollectionStatus,
  };
}

/** Push activity-captured beneficiaries into the Service Portal database. */
export async function syncBeneficiariesToPortal(
  entries: BeneficiaryEntry[],
  options: SyncBeneficiaryOptions
): Promise<SyncBeneficiaryResult> {
  const { projectId, requireService = false } = options;
  const synced: BeneficiaryEntry[] = [];
  let created = 0;
  let linked = 0;
  let servicesAdded = 0;

  for (const entry of entries) {
    if (requireService && !entry.serviceId) {
      throw new Error(`Select a service for ${entry.name || "beneficiary"} before completing.`);
    }

    if (entry.portalBeneficiaryId) {
      const flagRes = await fetch(`/api/beneficiaries/${entry.portalBeneficiaryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isUrgentCase: entry.isUrgentCase ?? false,
          isCaseStudy: entry.isCaseStudy ?? false,
        }),
      });
      if (!flagRes.ok) {
        const data = await flagRes.json();
        throw new Error(data.error ?? `Failed to update flags for ${entry.name}`);
      }

      if (entry.serviceId) {
        const res = await fetch(`/api/beneficiaries/${entry.portalBeneficiaryId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add_service",
            serviceId: entry.serviceId,
            notes: entry.notes || undefined,
            contributionCollectionStatus: entry.contributionCollectionStatus,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? `Failed to record service for ${entry.name}`);
        }
        servicesAdded += 1;
      }
      synced.push(entry);
      linked += 1;
      continue;
    }

    const res = await fetch("/api/beneficiaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(portalPayload(entry, projectId)),
    });
    const data = await res.json();
    if (!res.ok) {
      const message = data.error ?? `Failed to register ${entry.name} in Service Portal`;
      if (res.status >= 500) {
        throw new Error(`${message}. Is the database running? (npx prisma dev)`);
      }
      throw new Error(message);
    }

    synced.push({
      ...entry,
      portalBeneficiaryId: data.beneficiary.id,
      beneficiaryCode: data.beneficiary.beneficiaryCode,
    });
    created += 1;
  }

  return { beneficiaries: synced, created, linked, servicesAdded };
}
