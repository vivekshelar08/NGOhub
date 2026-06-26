"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/finance-utils";
import { loadProjects } from "@/lib/projects";
import { useFinanceMeta } from "@/hooks/useFinanceMeta";

interface BudgetLineForm {
  budgetHead: string;
  amount: string;
  fundId: string;
}

interface ProjectBudgetPanelProps {
  onFlash?: (msg: string, isError?: boolean) => void;
}

export function ProjectBudgetPanel({ onFlash }: ProjectBudgetPanelProps) {
  const { meta } = useFinanceMeta();
  const [projects, setProjects] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      description: string | null;
      fundingType: string | null;
      startDate: string | null;
      endDate: string | null;
      totalBudget: number | null;
      budgetLines: Array<{ budgetHead: string; amount: number; fund: { code: string } | null }>;
    }>
  >([]);
  const [legacyProjects, setLegacyProjects] = useState(loadProjects());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    fundingType: "CSR",
    startDate: "",
    endDate: "",
    totalBudget: "",
    legacyProjectId: "",
    budgetLines: [{ budgetHead: "Program activities", amount: "", fundId: "" }] as BudgetLineForm[],
  });

  const flash = (m: string, e?: boolean) => onFlash?.(m, e);

  const load = useCallback(async () => {
    const res = await fetch("/api/finance/projects");
    if (res.ok) {
      const d = await res.json();
      setProjects(d.projects ?? []);
    }
  }, []);

  useEffect(() => {
    load();
    setLegacyProjects(loadProjects().filter((p) => p.status === "APPROVED"));
  }, [load]);

  function updateBudgetLine(index: number, patch: Partial<BudgetLineForm>) {
    setForm((f) => ({
      ...f,
      budgetLines: f.budgetLines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  }

  function addBudgetLine() {
    setForm((f) => ({
      ...f,
      budgetLines: [...f.budgetLines, { budgetHead: "", amount: "", fundId: "" }],
    }));
  }

  function removeBudgetLine(index: number) {
    setForm((f) => ({
      ...f,
      budgetLines:
        f.budgetLines.length > 1 ? f.budgetLines.filter((_, i) => i !== index) : f.budgetLines,
    }));
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    const budgetLines = form.budgetLines
      .filter((l) => l.budgetHead && l.amount)
      .map((l) => ({
        budgetHead: l.budgetHead,
        amount: Number(l.amount),
        fundId: l.fundId || undefined,
      }));

    const res = await fetch("/api/finance/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        name: form.name,
        description: form.description || undefined,
        fundingType: form.fundingType,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        totalBudget: form.totalBudget ? Number(form.totalBudget) : undefined,
        legacyProjectId: form.legacyProjectId || undefined,
        budgetLines: budgetLines.length > 0 ? budgetLines : undefined,
      }),
    });
    if (res.ok) {
      flash("Project budget created");
      setShowForm(false);
      setForm({
        code: "",
        name: "",
        description: "",
        fundingType: "CSR",
        startDate: "",
        endDate: "",
        totalBudget: "",
        legacyProjectId: "",
        budgetLines: [{ budgetHead: "Program activities", amount: "", fundId: "" }],
      });
      load();
    } else {
      const d = await res.json();
      flash(d.error ?? "Failed to create project", true);
    }
  }

  return (
    <div className="space-y-4">
      <Button size="sm" onClick={() => setShowForm(!showForm)}>
        {showForm ? "Cancel" : "Add project budget"}
      </Button>

      {showForm && (
        <Card>
          <CardTitle>New finance project</CardTitle>
          <form onSubmit={createProject} className="mt-3 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Project code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="PRJ-001"
                  required
                />
              </div>
              <div>
                <Label>Project name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Funding type</Label>
                <Select
                  value={form.fundingType}
                  onChange={(e) => setForm({ ...form, fundingType: e.target.value })}
                >
                  <option value="CSR">CSR</option>
                  <option value="FCRA">FCRA</option>
                  <option value="GOVERNMENT">Government</option>
                  <option value="DONATION">Donation</option>
                  <option value="UNRESTRICTED">Unrestricted</option>
                </Select>
              </div>
              <div>
                <Label>Legacy project link</Label>
                <Select
                  value={form.legacyProjectId}
                  onChange={(e) => setForm({ ...form, legacyProjectId: e.target.value })}
                >
                  <option value="">None</option>
                  {legacyProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title || "Untitled"}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>End date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Total budget (₹)</Label>
                <Input
                  type="number"
                  value={form.totalBudget}
                  onChange={(e) => setForm({ ...form, totalBudget: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Budget lines</p>
                <Button type="button" size="sm" variant="outline" onClick={addBudgetLine}>
                  <Plus className="h-3.5 w-3.5" /> Add line
                </Button>
              </div>
              {form.budgetLines.map((line, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-4"
                >
                  <div>
                    <Label>Budget head</Label>
                    <Input
                      value={line.budgetHead}
                      onChange={(e) => updateBudgetLine(index, { budgetHead: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Amount (₹)</Label>
                    <Input
                      type="number"
                      value={line.amount}
                      onChange={(e) => updateBudgetLine(index, { amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Fund</Label>
                    <Select
                      value={line.fundId}
                      onChange={(e) => updateBudgetLine(index, { fundId: e.target.value })}
                    >
                      <option value="">None</option>
                      {meta?.funds.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.code}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-end">
                    {form.budgetLines.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => removeBudgetLine(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button type="submit">Save project</Button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {projects.map((p) => (
          <Card key={p.id}>
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <span className="font-mono text-sm text-brand-teal">{p.code}</span>
                <span className="ml-2 font-medium">{p.name}</span>
                {p.fundingType && (
                  <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs">
                    {p.fundingType}
                  </span>
                )}
                {(p.startDate || p.endDate) && (
                  <p className="mt-1 text-xs text-slate-500">
                    {p.startDate ?? "—"} to {p.endDate ?? "—"}
                  </p>
                )}
                {p.description && (
                  <p className="mt-1 text-sm text-slate-600">{p.description}</p>
                )}
              </div>
              {p.totalBudget != null && (
                <span className="font-semibold">{formatCurrency(p.totalBudget)}</span>
              )}
            </div>
            {p.budgetLines.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {p.budgetLines.map((b, i) => (
                  <li key={i} className="flex justify-between">
                    <span>
                      {b.budgetHead}
                      {b.fund && <span className="ml-1 text-xs">({b.fund.code})</span>}
                    </span>
                    <span>{formatCurrency(b.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
        {projects.length === 0 && (
          <p className="text-sm text-slate-500">
            No DB-backed project budgets yet. Create one to link expenses and grants to funds.
          </p>
        )}
      </div>
    </div>
  );
}
