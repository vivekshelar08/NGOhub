"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/finance-utils";

interface ProjectBudgetPanelProps {
  onFlash?: (msg: string, isError?: boolean) => void;
}

export function ProjectBudgetPanel({ onFlash }: ProjectBudgetPanelProps) {
  const [projects, setProjects] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      fundingType: string | null;
      totalBudget: number | null;
      budgetLines: Array<{ budgetHead: string; amount: number; fund: { code: string } | null }>;
    }>
  >([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    fundingType: "CSR",
    totalBudget: "",
    budgetHead: "Program activities",
    budgetAmount: "",
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
  }, [load]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/finance/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        name: form.name,
        fundingType: form.fundingType,
        totalBudget: form.totalBudget ? Number(form.totalBudget) : undefined,
        budgetLines: form.budgetAmount
          ? [{ budgetHead: form.budgetHead, amount: Number(form.budgetAmount) }]
          : undefined,
      }),
    });
    if (res.ok) {
      flash("Project budget created");
      setShowForm(false);
      setForm({
        code: "",
        name: "",
        fundingType: "CSR",
        totalBudget: "",
        budgetHead: "Program activities",
        budgetAmount: "",
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
          <form onSubmit={createProject} className="mt-3 grid gap-3 sm:grid-cols-2">
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
            <div>
              <Label>Funding type</Label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.fundingType}
                onChange={(e) => setForm({ ...form, fundingType: e.target.value })}
              >
                <option value="CSR">CSR</option>
                <option value="FCRA">FCRA</option>
                <option value="GOVERNMENT">Government</option>
                <option value="DONATION">Donation</option>
                <option value="UNRESTRICTED">Unrestricted</option>
              </select>
            </div>
            <div>
              <Label>Total budget (₹)</Label>
              <Input
                type="number"
                value={form.totalBudget}
                onChange={(e) => setForm({ ...form, totalBudget: e.target.value })}
              />
            </div>
            <div>
              <Label>Budget head</Label>
              <Input
                value={form.budgetHead}
                onChange={(e) => setForm({ ...form, budgetHead: e.target.value })}
              />
            </div>
            <div>
              <Label>Budget line amount (₹)</Label>
              <Input
                type="number"
                value={form.budgetAmount}
                onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })}
              />
            </div>
            <Button type="submit" className="sm:col-span-2">
              Save project
            </Button>
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
