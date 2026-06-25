"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  BeneficiaryEntry,
  createBeneficiaryId,
  findBeneficiariesFromActivities,
  normalizeMobile,
  PriorBeneficiaryMatch,
} from "@/lib/activities";
import { BENEFICIARY_CATEGORY_LABELS } from "@/lib/service-portal-utils";
import { BeneficiaryCategory } from "@/generated/prisma/enums";

interface PortalBeneficiary {
  id: string;
  beneficiaryCode: string;
  name: string;
  age: number | null;
  gender: string | null;
  mobile: string | null;
  address: string | null;
  category: BeneficiaryCategory;
  monthlyIncome: number | null;
  familyMembers: number | null;
  location: string | null;
  notes: string | null;
}

interface BeneficiaryCaptureSectionProps {
  beneficiaries: BeneficiaryEntry[];
  onChange: (beneficiaries: BeneficiaryEntry[]) => void;
  taskId: string;
  projectId?: string;
  /** When true, staff must pick a service for each new beneficiary */
  requireService?: boolean;
}

const EMPTY_FORM = (): BeneficiaryEntry => ({
  id: createBeneficiaryId(),
  name: "",
  contact: "",
  gender: "",
  category: "GENERAL",
  address: "",
  location: "",
  notes: "",
});

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

function portalToEntry(b: PortalBeneficiary): BeneficiaryEntry {
  return {
    id: createBeneficiaryId(),
    portalBeneficiaryId: b.id,
    beneficiaryCode: b.beneficiaryCode,
    name: b.name,
    age: b.age ?? undefined,
    gender: b.gender ?? "",
    contact: b.mobile ?? "",
    address: b.address ?? "",
    location: b.location ?? "",
    category: b.category,
    annualIncome: b.monthlyIncome != null ? b.monthlyIncome * 12 : undefined,
    familyMembers: b.familyMembers ?? undefined,
    notes: b.notes ?? "",
  };
}

function priorMatchToEntry(match: PriorBeneficiaryMatch): BeneficiaryEntry {
  return {
    ...match.entry,
    id: createBeneficiaryId(),
  };
}

export function BeneficiaryCaptureSection({
  beneficiaries,
  onChange,
  taskId,
  projectId,
  requireService = false,
}: BeneficiaryCaptureSectionProps) {
  const [showForm, setShowForm] = useState(beneficiaries.length === 0);
  const [form, setForm] = useState<BeneficiaryEntry>(EMPTY_FORM);
  const [mobileQuery, setMobileQuery] = useState("");
  const [portalMatches, setPortalMatches] = useState<PortalBeneficiary[]>([]);
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [portalError, setPortalError] = useState("");
  const [servicesError, setServicesError] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPrior, setSelectedPrior] = useState<PriorBeneficiaryMatch | null>(null);

  const activityMatches = useMemo(
    () => findBeneficiariesFromActivities(mobileQuery, taskId),
    [mobileQuery, taskId]
  );

  const searchPortal = useCallback(async (query: string) => {
    const digits = normalizeMobile(query);
    if (digits.length < 4) {
      setPortalMatches([]);
      setPortalError("");
      return;
    }
    setSearching(true);
    setPortalError("");
    try {
      const params = new URLSearchParams({ q: digits });
      const res = await fetch(`/api/beneficiaries?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPortalMatches(data.beneficiaries ?? []);
      } else {
        setPortalMatches([]);
        const data = await res.json().catch(() => ({}));
        setPortalError(
          (data as { error?: string }).error ??
            "Could not search Service Portal. Check that the database is running."
        );
      }
    } catch {
      setPortalMatches([]);
      setPortalError("Could not reach the server. Check that the app and database are running.");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/services")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ??
              "Could not load services. Check that the database is running."
          );
        }
        return res.json();
      })
      .then((data) => {
        const active = (data.services ?? []).filter(
          (s: { isActive: boolean }) => s.isActive
        );
        setServices(active.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
        setServicesError("");
      })
      .catch((err: unknown) => {
        setServices([]);
        setServicesError(
          err instanceof Error ? err.message : "Could not load services."
        );
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mobileQuery.length >= 4) {
        searchPortal(mobileQuery);
        setShowDropdown(true);
      } else {
        setPortalMatches([]);
        setShowDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [mobileQuery, searchPortal]);

  const hasDropdownItems =
    showDropdown &&
    mobileQuery.length >= 4 &&
    (activityMatches.length > 0 || portalMatches.length > 0);

  function updateFormField<K extends keyof BeneficiaryEntry>(field: K, value: BeneficiaryEntry[K]) {
    setSelectedPrior(null);
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "contact") {
      setMobileQuery(String(value ?? ""));
    }
  }

  function applyPortalMatch(b: PortalBeneficiary) {
    setForm(portalToEntry(b));
    setMobileQuery(b.mobile ?? "");
    setSelectedPrior({
      entry: portalToEntry(b),
      source: "portal",
      sourceLabel: b.beneficiaryCode,
    });
    setShowDropdown(false);
  }

  function applyActivityMatch(match: PriorBeneficiaryMatch) {
    setForm(priorMatchToEntry(match));
    setMobileQuery(match.entry.contact ?? "");
    setSelectedPrior(match);
    setShowDropdown(false);
  }

  function startNewBeneficiary() {
    const mobile = normalizeMobile(mobileQuery);
    setForm({
      ...EMPTY_FORM(),
      contact: mobile.length === 10 ? mobile : mobileQuery,
    });
    setSelectedPrior(null);
    setShowDropdown(false);
  }

  function addBeneficiary() {
    if (!form.name.trim()) return;
    if (!form.contact?.trim() || normalizeMobile(form.contact).length < 10) return;
    if (requireService && !form.serviceId) return;

    const serviceName = services.find((s) => s.id === form.serviceId)?.name;
    onChange([
      ...beneficiaries,
      {
        ...form,
        contact: normalizeMobile(form.contact),
        serviceName,
      },
    ]);
    setForm(EMPTY_FORM());
    setMobileQuery("");
    setSelectedPrior(null);
    setShowForm(false);
  }

  function removeBeneficiary(id: string) {
    onChange(beneficiaries.filter((b) => b.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className={labelClass}>Beneficiary details</label>
        {!showForm && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(true)}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Add beneficiary
          </Button>
        )}
      </div>

      {beneficiaries.length > 0 && (
        <ul className="space-y-2">
          {beneficiaries.map((ben, idx) => (
            <li
              key={ben.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-brand-teal/25 bg-brand-mist/50 px-3 py-2.5"
            >
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-900">
                  {idx + 1}. {ben.name}
                  {ben.beneficiaryCode && (
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      ({ben.beneficiaryCode})
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  📱 {ben.contact}
                  {ben.serviceName && ` · ${ben.serviceName}`}
                  {ben.category && ` · ${BENEFICIARY_CATEGORY_LABELS[ben.category as BeneficiaryCategory] ?? ben.category}`}
                  {ben.annualIncome != null && ` · ₹${ben.annualIncome.toLocaleString("en-IN")}/yr`}
                  {ben.familyMembers != null && ` · ${ben.familyMembers} members`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeBeneficiary(ben.id)}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-white hover:text-red-600"
                aria-label="Remove beneficiary"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">Enter mobile number first</p>

          <div className="relative">
            <label className={labelClass}>Mobile number *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className={cn(inputClass, "pl-9")}
                value={mobileQuery}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setMobileQuery(val);
                  updateFormField("contact", val);
                }}
                onFocus={() => mobileQuery.length >= 4 && setShowDropdown(true)}
                placeholder="10-digit mobile — search existing records"
                inputMode="numeric"
                maxLength={10}
              />
            </div>

            {hasDropdownItems && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {portalMatches.length > 0 && (
                  <div>
                    <p className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Service Portal
                    </p>
                    {portalMatches.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-brand-mist"
                        onClick={() => applyPortalMatch(b)}
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-teal" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {b.name} · {b.mobile}
                          </p>
                          <p className="text-xs text-slate-500">
                            {b.beneficiaryCode}
                            {b.category && ` · ${BENEFICIARY_CATEGORY_LABELS[b.category]}`}
                            {b.location && ` · ${b.location}`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {activityMatches.length > 0 && (
                  <div>
                    <p className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Previously covered in activities
                    </p>
                    {activityMatches.map((match, i) => (
                      <button
                        key={`${match.entry.contact}-${match.taskTitle}-${i}`}
                        type="button"
                        className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-amber-50"
                        onClick={() => applyActivityMatch(match)}
                      >
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {match.entry.name} · {match.entry.contact}
                          </p>
                          <p className="text-xs text-amber-700">
                            Covered in: {match.taskTitle}
                            {match.taskDate &&
                              ` (${new Date(match.taskDate).toLocaleDateString("en-IN")})`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {searching && (
              <p className="mt-1 text-xs text-slate-400">Searching records…</p>
            )}
            {portalError && (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {portalError}
              </p>
            )}
          </div>

          {mobileQuery.length >= 4 && !selectedPrior && (
            <button
              type="button"
              onClick={startNewBeneficiary}
              className="text-sm font-medium text-brand-teal hover:text-brand-teal-dark"
            >
              Not in list? Add as new beneficiary →
            </button>
          )}

          {selectedPrior && (
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-xs",
                selectedPrior.source === "portal"
                  ? "bg-brand-mist text-brand-teal-dark"
                  : "bg-amber-50 text-amber-800"
              )}
            >
              {selectedPrior.source === "portal"
                ? `Loaded from Service Portal (${selectedPrior.sourceLabel})`
                : `Loaded from previous activity: ${selectedPrior.sourceLabel}`}
            </div>
          )}

          {(selectedPrior !== null || normalizeMobile(mobileQuery).length >= 10) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Full name *</label>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => updateFormField("name", e.target.value)}
                  placeholder="Beneficiary full name"
                />
              </div>
              <div>
                <label className={labelClass}>Age</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  className={inputClass}
                  value={form.age ?? ""}
                  onChange={(e) =>
                    updateFormField("age", parseInt(e.target.value) || undefined)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Gender</label>
                <select
                  className={inputClass}
                  value={form.gender ?? ""}
                  onChange={(e) => updateFormField("gender", e.target.value)}
                >
                  <option value="">—</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Category *</label>
                <select
                  className={inputClass}
                  value={form.category ?? "GENERAL"}
                  onChange={(e) => updateFormField("category", e.target.value)}
                >
                  {Object.entries(BENEFICIARY_CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Annual income (₹)</label>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.annualIncome ?? ""}
                  onChange={(e) =>
                    updateFormField("annualIncome", parseInt(e.target.value) || undefined)
                  }
                  placeholder="Household income per year"
                />
              </div>
              <div>
                <label className={labelClass}>Family members</label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.familyMembers ?? ""}
                  onChange={(e) =>
                    updateFormField("familyMembers", parseInt(e.target.value) || undefined)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Village / Location</label>
                <input
                  className={inputClass}
                  value={form.location ?? ""}
                  onChange={(e) => updateFormField("location", e.target.value)}
                  placeholder="Village, ward, or area"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Address</label>
                <input
                  className={inputClass}
                  value={form.address ?? ""}
                  onChange={(e) => updateFormField("address", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  Service taken{requireService ? " *" : ""}
                </label>
                <select
                  className={inputClass}
                  value={form.serviceId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    updateFormField("serviceId", id || undefined);
                    updateFormField(
                      "serviceName",
                      services.find((s) => s.id === id)?.name
                    );
                  }}
                  required={requireService}
                >
                  <option value="">
                    {requireService ? "Select service delivered" : "No specific service (status only)"}
                  </option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {servicesError ? (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    {servicesError}
                  </p>
                ) : services.length === 0 ? (
                  <p className="mt-1 text-xs text-amber-700">
                    No services in catalog. Ask a manager to add services in Service Portal.
                  </p>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Notes</label>
                <textarea
                  className={cn(inputClass, "min-h-[60px]")}
                  value={form.notes ?? ""}
                  onChange={(e) => updateFormField("notes", e.target.value)}
                  placeholder="Urgent case, disability, special needs, etc."
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
            <Button
              type="button"
              size="sm"
              onClick={addBeneficiary}
              disabled={
                !form.name.trim() ||
                normalizeMobile(form.contact ?? "").length < 10 ||
                (requireService && !form.serviceId)
              }
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Save beneficiary
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY_FORM());
                setMobileQuery("");
                setSelectedPrior(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {beneficiaries.length === 0 && !showForm && (
        <p className="text-sm text-slate-400">
          No beneficiaries added yet. Start with the mobile number to check if they were covered before.
        </p>
      )}
    </div>
  );
}
