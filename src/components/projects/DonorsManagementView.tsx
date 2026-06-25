"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  createBlankDonor,
  deleteDonor,
  Donor,
  DONOR_CATEGORIES,
  formatDonorCategory,
  loadDonors,
  upsertDonor,
} from "@/lib/donors";
import { INDIAN_STATES_AND_UTS } from "@/lib/projectMeta";
import { loadProjects } from "@/lib/projects";
import { DonorPipelinePanel } from "@/components/donors/DonorPipelinePanel";

interface DonorsManagementViewProps {
  variant?: "light" | "dark";
}

export function DonorsManagementView({ variant = "dark" }: DonorsManagementViewProps) {
  const isDark = variant === "dark";
  const [donors, setDonors] = useState<Donor[]>([]);
  const [editing, setEditing] = useState<Donor | null>(null);
  const [showForm, setShowForm] = useState(false);

  const panel = isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white shadow-sm";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textMuted = isDark ? "text-slate-400" : "text-slate-500";
  const border = isDark ? "border-slate-800" : "border-slate-200";
  const fieldClass = isDark
    ? "border-slate-700 bg-slate-900/80 text-slate-100 placeholder:text-slate-500 focus:border-brand-teal/50 focus:ring-brand-teal/30"
    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-brand-teal";

  function refresh() {
    setDonors(loadDonors());
  }

  useEffect(() => {
    refresh();
    window.addEventListener("donors-updated", refresh);
    return () => window.removeEventListener("donors-updated", refresh);
  }, []);

  const projectCounts = useMemo(() => {
    const projects = loadProjects();
    const map = new Map<string, number>();
    for (const donor of donors) {
      map.set(
        donor.id,
        projects.filter((p) => (p.donorIds ?? []).includes(donor.id)).length
      );
    }
    return map;
  }, [donors]);

  function openNew() {
    setEditing(createBlankDonor());
    setShowForm(true);
  }

  function openEdit(donor: Donor) {
    setEditing({ ...donor });
    setShowForm(true);
  }

  function saveDonor() {
    if (!editing?.name.trim()) return;
    upsertDonor(editing);
    setShowForm(false);
    setEditing(null);
    refresh();
  }

  function removeDonor(donor: Donor) {
    const count = projectCounts.get(donor.id) ?? 0;
    const msg =
      count > 0
        ? `Delete "${donor.name}"? ${count} project(s) are linked — they will keep the reference but the donor record will be removed.`
        : `Delete "${donor.name}"?`;
    if (!window.confirm(msg)) return;
    deleteDonor(donor.id);
    refresh();
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={cn("text-xs font-medium uppercase tracking-widest", textMuted)}>Donors</p>
          <h1 className={cn("mt-1 text-2xl font-bold", textPrimary)}>Donor Management</h1>
          <p className={cn("mt-1 text-sm", textMuted)}>
            Maintain funders and partners. One donor can be mapped to multiple projects for CSR,
            donation, and government reporting.
          </p>
        </div>
        <Button type="button" variant="primary" size="sm" className="gap-1.5 shrink-0" onClick={openNew}>
          <Plus className="h-4 w-4" />
          Add donor
        </Button>
      </div>

      {showForm && editing && (
        <div className={cn("mb-6 rounded-xl border p-5", panel)}>
          <p className={cn("mb-4 text-sm font-semibold", textPrimary)}>
            {editing.name.trim() && donors.some((d) => d.id === editing.id) ? "Edit donor" : "New donor"}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={cn("mb-1 block text-xs font-medium uppercase", textMuted)}>Name *</label>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className={cn("w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1", fieldClass)}
              />
            </div>
            <div>
              <label className={cn("mb-1 block text-xs font-medium uppercase", textMuted)}>Category</label>
              <select
                value={editing.category}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value as Donor["category"] })
                }
                className={cn("w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1", fieldClass)}
              >
                {DONOR_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={cn("mb-1 block text-xs font-medium uppercase", textMuted)}>State</label>
              <select
                value={editing.state ?? ""}
                onChange={(e) => setEditing({ ...editing, state: e.target.value })}
                className={cn("w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1", fieldClass)}
              >
                <option value="">— Select —</option>
                {INDIAN_STATES_AND_UTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={cn("mb-1 block text-xs font-medium uppercase", textMuted)}>Organization</label>
              <input
                value={editing.organization ?? ""}
                onChange={(e) => setEditing({ ...editing, organization: e.target.value })}
                className={cn("w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1", fieldClass)}
              />
            </div>
            <div>
              <label className={cn("mb-1 block text-xs font-medium uppercase", textMuted)}>Contact person</label>
              <input
                value={editing.contactPerson ?? ""}
                onChange={(e) => setEditing({ ...editing, contactPerson: e.target.value })}
                className={cn("w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1", fieldClass)}
              />
            </div>
            <div>
              <label className={cn("mb-1 block text-xs font-medium uppercase", textMuted)}>Email</label>
              <input
                type="email"
                value={editing.email ?? ""}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                className={cn("w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1", fieldClass)}
              />
            </div>
            <div>
              <label className={cn("mb-1 block text-xs font-medium uppercase", textMuted)}>Phone</label>
              <input
                value={editing.phone ?? ""}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                className={cn("w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1", fieldClass)}
              />
            </div>
            <div className="md:col-span-2">
              <label className={cn("mb-1 block text-xs font-medium uppercase", textMuted)}>PAN / Reg. no.</label>
              <input
                value={editing.panOrRegNo ?? ""}
                onChange={(e) => setEditing({ ...editing, panOrRegNo: e.target.value })}
                className={cn("w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1", fieldClass)}
              />
            </div>
            <div className="md:col-span-2">
              <label className={cn("mb-1 block text-xs font-medium uppercase", textMuted)}>Notes</label>
              <textarea
                rows={2}
                value={editing.notes ?? ""}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                className={cn("w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1", fieldClass)}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="primary" size="sm" onClick={saveDonor}>
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className={cn("overflow-hidden rounded-xl border", panel)}>
        {donors.length === 0 ? (
          <p className={cn("p-8 text-center text-sm", textMuted)}>No donors yet. Add your first donor above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className={cn("border-b text-xs uppercase tracking-wide", border, textMuted)}>
                <tr>
                  <th className="px-4 py-3 font-medium">Donor</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Projects</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {donors.map((donor) => (
                  <tr key={donor.id} className={cn("border-b last:border-0", border)}>
                    <td className={cn("px-4 py-3 font-medium", textPrimary)}>
                      {donor.name}
                      {donor.organization && (
                        <span className={cn("mt-0.5 block text-xs font-normal", textMuted)}>
                          {donor.organization}
                        </span>
                      )}
                    </td>
                    <td className={cn("px-4 py-3", textMuted)}>{formatDonorCategory(donor.category)}</td>
                    <td className={cn("px-4 py-3", textMuted)}>{donor.state || "—"}</td>
                    <td className={cn("px-4 py-3 text-xs", textMuted)}>
                      {donor.email || donor.phone || "—"}
                    </td>
                    <td className={cn("px-4 py-3 tabular-nums", textPrimary)}>
                      {projectCounts.get(donor.id) ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(donor)}
                          className={cn(
                            "rounded p-1.5 transition-colors",
                            isDark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
                          )}
                          aria-label="Edit donor"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDonor(donor)}
                          className="rounded p-1.5 text-red-500 transition-colors hover:bg-red-500/10"
                          aria-label="Delete donor"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DonorPipelinePanel variant={variant} />
    </div>
  );
}
