export type DonorCategory =
  | "CORPORATE"
  | "INDIVIDUAL"
  | "FOUNDATION"
  | "GOVERNMENT"
  | "BILATERAL"
  | "OTHER";

export interface Donor {
  id: string;
  name: string;
  category: DonorCategory;
  organization?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  state?: string;
  panOrRegNo?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const DONOR_CATEGORIES: { value: DonorCategory; label: string }[] = [
  { value: "CORPORATE", label: "Corporate" },
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "FOUNDATION", label: "Foundation / Trust" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "BILATERAL", label: "Bilateral / Multilateral" },
  { value: "OTHER", label: "Other" },
];

export const DONORS_STORAGE_KEY = "ngo-hub-donors";

export function formatDonorCategory(category: DonorCategory): string {
  return DONOR_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

function normalizeDonor(raw: Donor): Donor {
  return {
    ...raw,
    category: raw.category ?? "OTHER",
    name: raw.name ?? "",
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

export function loadDonors(): Donor[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DONORS_STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Donor[]).map(normalizeDonor);
  } catch {
    return [];
  }
}

export function saveDonors(donors: Donor[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DONORS_STORAGE_KEY, JSON.stringify(donors));
  window.dispatchEvent(new Event("donors-updated"));
}

export function getDonorById(id: string): Donor | undefined {
  return loadDonors().find((d) => d.id === id);
}

export function upsertDonor(donor: Donor): Donor {
  const normalized = normalizeDonor({ ...donor, updatedAt: new Date().toISOString() });
  const donors = loadDonors();
  const index = donors.findIndex((d) => d.id === normalized.id);
  if (index >= 0) {
    donors[index] = normalized;
  } else {
    donors.push(normalized);
  }
  saveDonors(donors);
  return normalized;
}

export function deleteDonor(id: string) {
  saveDonors(loadDonors().filter((d) => d.id !== id));
}

export function createBlankDonor(): Donor {
  const now = new Date().toISOString();
  return {
    id: `donor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    category: "CORPORATE",
    createdAt: now,
    updatedAt: now,
  };
}

export function formatDonorLabel(donor: Donor): string {
  const org = donor.organization?.trim();
  return org ? `${donor.name} (${org})` : donor.name;
}

export function resolveDonorLabels(ids: string[], donors: Donor[]): string {
  if (ids.length === 0) return "—";
  return ids
    .map((id) => donors.find((d) => d.id === id))
    .filter(Boolean)
    .map((d) => formatDonorLabel(d!))
    .join("; ");
}

export function countDonorProjects(donorId: string, projectDonorIds: string[][]): number {
  return projectDonorIds.filter((ids) => ids.includes(donorId)).length;
}
