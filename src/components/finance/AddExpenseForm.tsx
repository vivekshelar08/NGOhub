"use client";

import { useEffect, useMemo, useState } from "react";
import { FileAttachment } from "@/lib/activities";
import { FileUploadTabs } from "@/components/activities/FileUploadTabs";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { HelpTip } from "@/components/ui/HelpTip";
import { EXPENSE_CATEGORY_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/finance-utils";
import { loadProjects, ProjectProposal } from "@/lib/projects";
import { ExpenseCategory, PaymentType } from "@/generated/prisma/enums";
import { enqueueOffline } from "@/lib/offlineQueue";
import { useFinanceMeta } from "@/hooks/useFinanceMeta";

interface AddExpenseFormProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function AddExpenseForm({ onSuccess, onError }: AddExpenseFormProps) {
  const { meta } = useFinanceMeta();
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<FileAttachment[]>([]);
  const [pdfs, setPdfs] = useState<FileAttachment[]>([]);
  const [form, setForm] = useState({
    category: "TRAVEL" as ExpenseCategory,
    paymentType: "UPI" as PaymentType,
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    description: "",
    conveyanceFrom: "",
    conveyanceTo: "",
    conveyanceKm: "",
    projectId: "",
    budgetHead: "",
    fundType: "",
    fundId: "",
    financeProjectId: "",
  });
  const [projects, setProjects] = useState<ProjectProposal[]>([]);

  useEffect(() => {
    setProjects(loadProjects().filter((p) => p.status === "APPROVED"));
  }, []);

  const selectedFinanceProject = useMemo(
    () => meta?.financeProjects.find((p) => p.id === form.financeProjectId),
    [meta, form.financeProjectId]
  );

  const budgetHeads = useMemo(() => {
    if (selectedFinanceProject?.budgetLines.length) {
      return selectedFinanceProject.budgetLines.map((l) => l.budgetHead).filter(Boolean);
    }
    const p = projects.find((x) => x.id === form.projectId);
    if (!p) return [];
    return (p.budget ?? []).map((c) => c.title).filter(Boolean);
  }, [projects, form.projectId, selectedFinanceProject]);

  async function submitExpense(body: Record<string, unknown>) {
    const res = await fetch("/api/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const attachments = [
      ...photos.map((p) => ({ fileName: p.name, mimeType: p.mimeType, dataUrl: p.dataUrl })),
      ...pdfs.map((p) => ({ fileName: p.name, mimeType: p.mimeType, dataUrl: p.dataUrl })),
    ];

    if (attachments.length === 0) {
      onError("Please upload at least one bill photo or PDF as proof");
      return;
    }

    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      onError("Enter a valid amount");
      return;
    }

    setLoading(true);
    const payload = {
      category: form.category,
      paymentType: form.paymentType,
      amount,
      expenseDate: form.expenseDate,
      description: form.description || undefined,
      conveyanceFrom: form.category === "TRAVEL" ? form.conveyanceFrom : undefined,
      conveyanceTo: form.category === "TRAVEL" ? form.conveyanceTo : undefined,
      conveyanceKm: form.conveyanceKm ? parseFloat(form.conveyanceKm) : undefined,
      projectId: form.projectId || undefined,
      budgetHead: form.budgetHead || undefined,
      fundType: form.fundType || undefined,
      fundId: form.fundId || undefined,
      financeProjectId: form.financeProjectId || undefined,
      attachments,
    };

    if (!navigator.onLine) {
      enqueueOffline("expense_submit", payload);
      setLoading(false);
      onSuccess("Saved offline — will sync when you are back online");
      return;
    }

    const res = await submitExpense(payload);
    setLoading(false);

    if (!res.ok) {
      let message = "Failed to submit expense";
      try {
        const data = await res.json();
        message = data.error ?? message;
      } catch {
        message = res.status === 500
          ? "Server error — try restarting the app and submit again"
          : message;
      }
      onError(message);
      return;
    }

    onSuccess("Expense submitted for approval");
    setForm({
      category: "TRAVEL",
      paymentType: "UPI",
      amount: "",
      expenseDate: new Date().toISOString().slice(0, 10),
      description: "",
      conveyanceFrom: "",
      conveyanceTo: "",
      conveyanceKm: "",
      projectId: "",
      budgetHead: "",
      fundType: "",
      fundId: "",
      financeProjectId: "",
    });
    setPhotos([]);
    setPdfs([]);
  }

  const isTravel = form.category === "TRAVEL";

  return (
    <Card>
      <CardTitle className="mb-1 text-lg">Add Expense</CardTitle>
      <p className="mb-6 text-sm text-slate-500">
        Submit travel, camp, stationery, or other expenses with bill proof and payment type.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Category</Label>
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
            >
              {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((key) => (
                <option key={key} value={key}>
                  {EXPENSE_CATEGORY_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Payment type</Label>
            <Select
              value={form.paymentType}
              onChange={(e) => setForm({ ...form, paymentType: e.target.value as PaymentType })}
            >
              {(Object.keys(PAYMENT_TYPE_LABELS) as PaymentType[]).map((key) => (
                <option key={key} value={key}>
                  {PAYMENT_TYPE_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Amount (INR)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label>Expense date</Label>
            <Input
              type="date"
              required
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            Link to project & fund (optional)
            <HelpTip helpKey="budget_head" />
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Fund</Label>
              <Select
                value={form.fundId}
                onChange={(e) => setForm({ ...form, fundId: e.target.value })}
              >
                <option value="">None</option>
                {meta?.funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} — {f.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Finance project</Label>
              <Select
                value={form.financeProjectId}
                onChange={(e) =>
                  setForm({ ...form, financeProjectId: e.target.value, budgetHead: "" })
                }
              >
                <option value="">None</option>
                {meta?.financeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Legacy project</Label>
              <Select
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value, budgetHead: "" })}
                disabled={!!form.financeProjectId}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title || "Untitled"}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Budget head</Label>
              <Select
                value={form.budgetHead}
                onChange={(e) => setForm({ ...form, budgetHead: e.target.value })}
                disabled={!form.projectId && !form.financeProjectId}
              >
                <option value="">None</option>
                {budgetHeads.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Fund type (legacy)</Label>
              <Select value={form.fundType} onChange={(e) => setForm({ ...form, fundType: e.target.value })}>
                <option value="">Not specified</option>
                <option value="CSR">CSR</option>
                <option value="FCRA">FCRA</option>
                <option value="RESTRICTED">Restricted</option>
                <option value="GENERAL">General</option>
              </Select>
            </div>
          </div>
        </div>

        {isTravel && (
          <div className="rounded-xl border border-brand-teal/20 bg-brand-teal/5 p-4">
            <p className="mb-3 text-sm font-semibold text-brand-ink">Local conveyance details</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>From</Label>
                <Input
                  required
                  value={form.conveyanceFrom}
                  onChange={(e) => setForm({ ...form, conveyanceFrom: e.target.value })}
                  placeholder="Origin location"
                />
              </div>
              <div>
                <Label>To</Label>
                <Input
                  required
                  value={form.conveyanceTo}
                  onChange={(e) => setForm({ ...form, conveyanceTo: e.target.value })}
                  placeholder="Destination"
                />
              </div>
              <div>
                <Label>Distance (km)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.conveyanceKm}
                  onChange={(e) => setForm({ ...form, conveyanceKm: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <Label>Description / purpose</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Brief description of the expense"
          />
        </div>

        <div>
          <Label className="mb-2">Bill proof (photo or PDF)</Label>
          <FileUploadTabs
            photos={photos}
            pdfs={pdfs}
            onPhotosChange={setPhotos}
            onPdfsChange={setPdfs}
            disabled={loading}
          />
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Submitting…" : "Submit expense"}
        </Button>
      </form>
    </Card>
  );
}
