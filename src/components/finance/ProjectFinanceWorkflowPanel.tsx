"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/finance-utils";
import {
  computeBudgetTotals,
  budgetAdminInputFromProject,
  loadProjects as loadLegacyProjects,
  type ProjectProposal,
} from "@/lib/projects";

interface WorkflowProject {
  id: string;
  code: string;
  name: string;
  legacyProjectId: string | null;
  totalBudget: number | null;
  donorName: string | null;
}

interface WorkflowMilestone {
  id: string;
  milestoneName: string;
  status: string;
  budgetAmount: number;
  achievementPct: number;
  actual: number;
  pending: number;
  remaining: number;
  utilizationPercent: number;
  utilizationCerts: Array<{
    id: string;
    status: string;
    totalUtilized: number;
    periodStart: string;
    periodEnd: string;
    grantInvoice?: { id: string; invoiceNumber: string; status: string; amount: number } | null;
  }>;
  grantInvoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    amount: number;
    payments: Array<{ id: string; amount: number }>;
  }>;
}

interface ProjectFinanceWorkflowPanelProps {
  onFlash?: (msg: string, isError?: boolean) => void;
}

const STEPS = ["Milestone", "UC", "Invoice", "Payment", "Budget"];

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function ProjectFinanceWorkflowPanel({ onFlash }: ProjectFinanceWorkflowPanelProps) {
  const [projects, setProjects] = useState<WorkflowProject[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [milestones, setMilestones] = useState<WorkflowMilestone[]>([]);
  const [legacyProjects, setLegacyProjects] = useState<ProjectProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expenses, setExpenses] = useState<
    Array<{ id: string; amount: number; description: string | null; expenseDate: string }>
  >([]);
  const [ucForm, setUcForm] = useState({
    milestoneBudgetId: "",
    periodStart: "",
    periodEnd: "",
    expenseIds: [] as string[],
  });
  const [invoiceForm, setInvoiceForm] = useState({
    ucId: "",
    donorName: "",
    donorPan: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
  });
  const [paymentForm, setPaymentForm] = useState({
    invoiceId: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: "",
    reference: "",
  });

  const flash = (msg: string, err?: boolean) => onFlash?.(msg, err);

  const fetchFinanceProjects = useCallback(async () => {
    const res = await fetch("/api/finance/workflow");
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects ?? []);
    }
  }, []);

  const loadWorkflow = useCallback(async (financeProjectId: string) => {
    setLoading(true);
    const [wfRes, expRes] = await Promise.all([
      fetch(`/api/finance/workflow?financeProjectId=${financeProjectId}`),
      fetch(`/api/finance/expenses?all=1&status=APPROVED`),
    ]);
    if (wfRes.ok) {
      const data = await wfRes.json();
      setMilestones(data.milestones ?? []);
    }
    if (expRes.ok) {
      const data = await expRes.json();
      setExpenses(
        (data.expenses ?? [])
          .filter((e: { financeProjectId: string | null }) => e.financeProjectId === financeProjectId)
          .map((e: { id: string; amount: number; description: string | null; expenseDate: string }) => ({
            id: e.id,
            amount: e.amount,
            description: e.description,
            expenseDate: e.expenseDate,
          }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFinanceProjects();
    setLegacyProjects(loadLegacyProjects().filter((p) => p.status === "APPROVED"));
  }, [fetchFinanceProjects]);

  useEffect(() => {
    if (selectedId) loadWorkflow(selectedId);
  }, [selectedId, loadWorkflow]);

  const selectedProject = projects.find((p) => p.id === selectedId);
  const linkedLegacy = useMemo(
    () => legacyProjects.find((p) => p.id === selectedProject?.legacyProjectId),
    [legacyProjects, selectedProject?.legacyProjectId]
  );

  async function syncMilestones() {
    if (!selectedId || !linkedLegacy?.setup?.milestones?.length) {
      flash("Link this finance project to an approved program project with milestones first.", true);
      return;
    }
    const totals = computeBudgetTotals(
      linkedLegacy.budget ?? [],
      budgetAdminInputFromProject(linkedLegacy)
    );
    setSyncing(true);
    const res = await fetch("/api/finance/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sync_milestones",
        financeProjectId: selectedId,
        totalBudget: totals.totalEvaluation,
        milestones: linkedLegacy.setup.milestones.map((m) => ({
          id: m.id,
          name: m.name,
          budgetPercent: m.budgetPercent,
          kpis: m.kpis.map((k) => ({
            achievedActivityCount: k.achievedActivityCount,
            activityCount: k.activityCount,
            achievedBeneficiaryCount: k.achievedBeneficiaries,
            beneficiaryCount: k.beneficiaryCount,
          })),
        })),
      }),
    });
    setSyncing(false);
    if (!res.ok) {
      flash((await res.json()).error ?? "Sync failed", true);
      return;
    }
    flash("Milestones synced from program delivery data");
    loadWorkflow(selectedId);
  }

  async function createUc() {
    if (!ucForm.milestoneBudgetId || ucForm.expenseIds.length === 0) {
      flash("Select milestone and expenses for the UC", true);
      return;
    }
    const res = await fetch("/api/finance/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_uc", ...ucForm }),
    });
    if (!res.ok) {
      flash((await res.json()).error ?? "UC creation failed", true);
      return;
    }
    flash("Utilization certificate drafted");
    loadWorkflow(selectedId);
  }

  async function ucAction(ucId: string, action: "submit_uc" | "approve_uc") {
    const res = await fetch("/api/finance/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ucId }),
    });
    if (!res.ok) {
      flash((await res.json()).error ?? "Action failed", true);
      return;
    }
    flash(action === "submit_uc" ? "UC submitted for approval" : "UC approved");
    loadWorkflow(selectedId);
  }

  async function createInvoice() {
    const res = await fetch("/api/finance/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_invoice", ...invoiceForm }),
    });
    if (!res.ok) {
      flash((await res.json()).error ?? "Invoice failed", true);
      return;
    }
    flash("Grant invoice created");
    setInvoiceForm({ ucId: "", donorName: "", donorPan: "", invoiceDate: new Date().toISOString().slice(0, 10) });
    loadWorkflow(selectedId);
  }

  async function recordPayment() {
    const amount = Number(paymentForm.amount);
    if (!paymentForm.invoiceId || !amount) {
      flash("Select invoice and amount", true);
      return;
    }
    const res = await fetch("/api/finance/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record_payment",
        invoiceId: paymentForm.invoiceId,
        paymentDate: paymentForm.paymentDate,
        amount,
        reference: paymentForm.reference || undefined,
      }),
    });
    if (!res.ok) {
      flash((await res.json()).error ?? "Payment failed", true);
      return;
    }
    const data = await res.json();
    flash(`Payment recorded — GL ${data.voucherNumber}`);
    setPaymentForm({
      invoiceId: "",
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: "",
      reference: "",
    });
    loadWorkflow(selectedId);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>NGO grant workflow</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Milestone delivery → UC → invoice to donor → payment received → budget vs expense. Sync
          milestones from your approved program project, then walk each tranche through compliance.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
          {STEPS.map((step, i) => (
            <span key={step} className="flex items-center gap-1">
              {i > 0 && <ArrowRight className="h-3 w-3" />}
              {step}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Finance project</Label>
            <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              disabled={!selectedId || syncing}
              onClick={syncMilestones}
            >
              <RefreshCw className="h-4 w-4" />
              {syncing ? "Syncing…" : "Sync milestones from program"}
            </Button>
          </div>
        </div>
        {selectedProject && !selectedProject.legacyProjectId && (
          <p className="mt-3 text-sm text-amber-700">
            Link a program project under Finance → Project budgets (legacy project field).
          </p>
        )}
      </Card>

      {loading && selectedId ? (
        <p className="text-sm text-slate-500">Loading workflow…</p>
      ) : (
        milestones.map((m) => (
          <Card key={m.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-brand-ink">{m.milestoneName}</h3>
                <p className="text-sm text-slate-500">
                  Budget {formatCurrency(m.budgetAmount)} · Achievement {m.achievementPct.toFixed(0)}%
                  · Spent {formatCurrency(m.actual)}
                  {m.pending > 0 && ` · Pending ${formatCurrency(m.pending)}`}
                </p>
                <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs">
                  {statusLabel(m.status)}
                </span>
              </div>
              <div className="text-right text-sm">
                <p>Utilization {m.utilizationPercent.toFixed(1)}%</p>
                <p className="text-slate-500">Remaining {formatCurrency(m.remaining)}</p>
              </div>
            </div>

            {m.utilizationCerts.map((uc) => (
              <div
                key={uc.id}
                className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm"
              >
                <p className="font-medium">
                  UC {uc.periodStart} → {uc.periodEnd} · {formatCurrency(uc.totalUtilized)} ·{" "}
                  {uc.status}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {uc.status === "DRAFT" && (
                    <Button size="sm" variant="outline" onClick={() => ucAction(uc.id, "submit_uc")}>
                      Submit UC
                    </Button>
                  )}
                  {uc.status === "SUBMITTED" && (
                    <Button size="sm" onClick={() => ucAction(uc.id, "approve_uc")}>
                      Approve UC
                    </Button>
                  )}
                  {uc.status === "APPROVED" && !uc.grantInvoice && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setInvoiceForm((f) => ({
                          ...f,
                          ucId: uc.id,
                          donorName: selectedProject?.donorName ?? "",
                        }))
                      }
                    >
                      Create invoice
                    </Button>
                  )}
                  {uc.grantInvoice && (
                    <span className="text-brand-teal">
                      Invoice {uc.grantInvoice.invoiceNumber} ({uc.grantInvoice.status})
                    </span>
                  )}
                </div>
              </div>
            ))}

            {m.achievementPct >= 50 && m.utilizationCerts.length === 0 && (
              <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-3">
                <p className="mb-2 text-sm font-medium">Create UC from approved expenses</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    type="date"
                    value={ucForm.milestoneBudgetId === m.id ? ucForm.periodStart : ""}
                    onChange={(e) =>
                      setUcForm({
                        milestoneBudgetId: m.id,
                        periodStart: e.target.value,
                        periodEnd: ucForm.periodEnd,
                        expenseIds: ucForm.expenseIds,
                      })
                    }
                  />
                  <Input
                    type="date"
                    value={ucForm.milestoneBudgetId === m.id ? ucForm.periodEnd : ""}
                    onChange={(e) =>
                      setUcForm({ ...ucForm, milestoneBudgetId: m.id, periodEnd: e.target.value })
                    }
                  />
                </div>
                <div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-sm">
                  {expenses.map((e) => (
                    <label key={e.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={
                          ucForm.milestoneBudgetId === m.id && ucForm.expenseIds.includes(e.id)
                        }
                        onChange={(ev) => {
                          setUcForm((f) => {
                            const ids = ev.target.checked
                              ? [...f.expenseIds, e.id]
                              : f.expenseIds.filter((id) => id !== e.id);
                            return { ...f, milestoneBudgetId: m.id, expenseIds: ids };
                          });
                        }}
                      />
                      {e.expenseDate} — {formatCurrency(e.amount)} {e.description ?? ""}
                    </label>
                  ))}
                </div>
                <Button size="sm" className="mt-2" onClick={createUc}>
                  Draft UC
                </Button>
              </div>
            )}
          </Card>
        ))
      )}

      {invoiceForm.ucId && (
        <Card>
          <CardTitle>Create grant invoice</CardTitle>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Donor name</Label>
              <Input
                value={invoiceForm.donorName}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, donorName: e.target.value })}
              />
            </div>
            <div>
              <Label>Donor PAN</Label>
              <Input
                value={invoiceForm.donorPan}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, donorPan: e.target.value })}
              />
            </div>
            <div>
              <Label>Invoice date</Label>
              <Input
                type="date"
                value={invoiceForm.invoiceDate}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })}
              />
            </div>
          </div>
          <Button className="mt-3" onClick={createInvoice}>
            Issue invoice
          </Button>
        </Card>
      )}

      {paymentForm.invoiceId && (
        <Card>
          <CardTitle>Record grant payment</CardTitle>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Payment date</Label>
              <Input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Reference</Label>
              <Input
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
              />
            </div>
          </div>
          <Button className="mt-3" onClick={recordPayment}>
            Record payment & post to GL
          </Button>
        </Card>
      )}

      {milestones.some((m) => m.grantInvoices.some((i) => i.status !== "PAID")) && (
        <Card>
          <CardTitle>Pending payments</CardTitle>
          <div className="mt-2 space-y-2">
            {milestones.flatMap((m) =>
              m.grantInvoices
                .filter((i) => i.status !== "PAID")
                .map((i) => (
                  <div
                    key={i.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {i.invoiceNumber} — {formatCurrency(i.amount)} ({i.status})
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPaymentForm({
                          invoiceId: i.id,
                          paymentDate: new Date().toISOString().slice(0, 10),
                          amount: String(
                            i.amount - i.payments.reduce((s, p) => s + p.amount, 0)
                          ),
                          reference: "",
                        })
                      }
                    >
                      Record payment
                    </Button>
                  </div>
                ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
