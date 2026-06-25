"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  createBlankDonor,
  Donor,
  DONOR_CATEGORIES,
  formatDonorCategory,
  formatDonorLabel,
  loadDonors,
  upsertDonor,
} from "@/lib/donors";
import { fundingTypeRequiresDonor, ProjectFundingType } from "@/lib/projectMeta";

interface DonorSelectorProps {
  value: string[];
  onChange: (ids: string[]) => void;
  fundingType: ProjectFundingType;
  isDark?: boolean;
}

export function DonorSelector({ value, onChange, fundingType, isDark = false }: DonorSelectorProps) {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState(createBlankDonor);
  const selected = new Set(value);
  const label = isDark ? "text-slate-500" : "text-slate-600";
  const border = isDark ? "border-slate-800" : "border-slate-200";
  const fieldClass = isDark
    ? "border-slate-700 bg-slate-900/80 text-slate-100 placeholder:text-slate-500 focus:border-brand-teal/50 focus:ring-brand-teal/30"
    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-brand-teal";

  function refreshDonors() {
    setDonors(loadDonors());
  }

  useEffect(() => {
    refreshDonors();
    window.addEventListener("donors-updated", refreshDonors);
    return () => window.removeEventListener("donors-updated", refreshDonors);
  }, []);

  function toggle(id: string) {
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  function saveNewDonor() {
    if (!draft.name.trim()) return;
    const saved = upsertDonor(draft);
    refreshDonors();
    onChange([...value, saved.id]);
    setDraft(createBlankDonor());
    setShowAdd(false);
  }

  const requiresDonor = fundingTypeRequiresDonor(fundingType);

  return (
    <div>
      <p className={cn("mb-3 text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
        {requiresDonor
          ? "Select one or more donors for this project. The same donor can fund multiple projects."
          : "Optionally link donors. Leave empty for internal or self-funded projects."}
      </p>

      {donors.length === 0 && !showAdd ? (
        <p className={cn("mb-3 rounded-lg border border-dashed p-4 text-sm", border, label)}>
          No donors yet. Add a donor to map this project.
        </p>
      ) : (
        <div className="mb-3 max-h-56 space-y-2 overflow-y-auto">
          {donors.map((donor) => {
            const checked = selected.has(donor.id);
            return (
              <label
                key={donor.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                  border,
                  checked
                    ? isDark
                      ? "border-brand-teal/50 bg-brand-mist/10"
                      : "border-brand-teal bg-brand-mist"
                    : isDark
                      ? "hover:bg-slate-800/50"
                      : "hover:bg-slate-50"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(donor.id)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                />
                <span>
                  <span className={cn("font-medium", isDark ? "text-white" : "text-slate-900")}>
                    {formatDonorLabel(donor)}
                  </span>
                  <span className={cn("mt-0.5 block text-xs", label)}>
                    {formatDonorCategory(donor.category)}
                    {donor.state ? ` · ${donor.state}` : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {showAdd ? (
        <div className={cn("space-y-3 rounded-lg border p-4", border, isDark ? "bg-slate-950/40" : "bg-slate-50")}>
          <p className={cn("text-xs font-semibold uppercase", label)}>New donor</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Donor name *"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 sm:col-span-2",
                fieldClass
              )}
            />
            <select
              value={draft.category}
              onChange={(e) =>
                setDraft((d) => ({ ...d, category: e.target.value as Donor["category"] }))
              }
              className={cn("w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1", fieldClass)}
            >
              {DONOR_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Organization (optional)"
              value={draft.organization ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, organization: e.target.value }))}
              className={cn("w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1", fieldClass)}
            />
            <input
              type="email"
              placeholder="Email"
              value={draft.email ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              className={cn("w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1", fieldClass)}
            />
            <input
              type="text"
              placeholder="Phone"
              value={draft.phone ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              className={cn("w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1", fieldClass)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="primary" size="sm" onClick={saveNewDonor}>
              Save donor
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="h-4 w-4" />
          Add donor
        </Button>
      )}

      {value.length > 0 && (
        <p className={cn("mt-3 text-xs", label)}>
          {value.length} donor{value.length === 1 ? "" : "s"} linked
        </p>
      )}
    </div>
  );
}
