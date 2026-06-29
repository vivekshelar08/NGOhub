"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, FolderOpen, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { HelpTip } from "@/components/ui/HelpTip";
import { Input, Label } from "@/components/ui/Input";
import { readFileAsDataUrl } from "@/lib/activities";
import {
  computeMeSnapshot,
  computeProjectBudgetSummary,
  formatBudgetCurrency,
  RAG_LABELS,
  RAG_STYLES,
  type ExpenseForBudget,
} from "@/lib/budgetTracking";
import { exportDonorReportPack } from "@/lib/donorReportPack";
import { generateUcDocx } from "@/lib/ucExport";
import { computeCatalogAchievementTotals, ProjectProposal } from "@/lib/projects";
import { cn } from "@/lib/utils";

interface VaultDocument {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  category: string;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

interface ProjectEnhancementsPanelProps {
  projectId: string;
  project: ProjectProposal;
}

type PanelTab = "budget" | "me" | "vault";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function currentFyLabel() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY ${year}-${String(year + 1).slice(-2)}`;
}

export function ProjectEnhancementsPanel({ projectId, project }: ProjectEnhancementsPanelProps) {
  const [tab, setTab] = useState<PanelTab>("budget");
  const [expenses, setExpenses] = useState<ExpenseForBudget[]>([]);
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [beneficiaryCount, setBeneficiaryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState<"uc" | "donor" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const budget = useMemo(
    () => computeProjectBudgetSummary(project, expenses),
    [project, expenses]
  );
  const meRows = useMemo(() => computeMeSnapshot(project), [project]);

  const servicesDelivered = useMemo(() => {
    if (!project.setup) return 0;
    return computeCatalogAchievementTotals(project.setup).achievedActivities;
  }, [project.setup]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, vaultRes, benRes] = await Promise.all([
        fetch(`/api/finance/expenses?all=1&projectId=${encodeURIComponent(projectId)}`),
        fetch(`/api/vault?projectId=${encodeURIComponent(projectId)}`),
        fetch(`/api/beneficiaries?projectId=${encodeURIComponent(projectId)}&countOnly=1`),
      ]);

      if (expRes.ok) {
        const data = await expRes.json();
        setExpenses(
          (data.expenses ?? []).map(
            (e: { projectId: string | null; budgetHead: string | null; amount: number; status: string }) => ({
              projectId: e.projectId,
              budgetHead: e.budgetHead,
              amount: e.amount,
              status: e.status,
            })
          )
        );
      }

      if (vaultRes.ok) {
        const data = await vaultRes.json();
        setDocuments(data.documents ?? []);
      }

      if (benRes.ok) {
        const data = await benRes.json();
        setBeneficiaryCount(data.count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file.name,
          category: "CSR",
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          dataUrl,
          projectId,
        }),
      });
      if (!res.ok) throw new Error("Upload failed");
      setMessage("Document uploaded.");
      load();
    } catch {
      setMessage("Failed to upload document.");
    } finally {
      setUploading(false);
    }
  }

  async function handleUcDraft() {
    setExporting("uc");
    setMessage(null);
    try {
      let orgName = "SVITECH Foundation";
      try {
        const orgRes = await fetch("/api/org-settings");
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          orgName = orgData.settings?.orgName ?? orgName;
        }
      } catch {
        /* use default */
      }
      const blob = await generateUcDocx(project, budget, currentFyLabel(), orgName);
      downloadBlob(blob, `uc-draft-${projectId.slice(0, 8)}.docx`);
    } catch {
      setMessage("Failed to generate UC draft.");
    } finally {
      setExporting(null);
    }
  }

  function handleDonorPack() {
    setExporting("donor");
    setMessage(null);
    try {
      exportDonorReportPack({
        project,
        budget,
        meIndicators: meRows,
        beneficiaryCount,
        servicesDelivered,
        periodLabel: currentFyLabel(),
      });
    } catch {
      setMessage("Failed to export donor report pack.");
    } finally {
      setExporting(null);
    }
  }

  const tabs: Array<{ id: PanelTab; label: string }> = [
    { id: "budget", label: "Budget vs actual" },
    { id: "me", label: "M&E RAG" },
    { id: "vault", label: "Document vault" },
  ];

  return (
    <Card className="mt-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Project reporting & documents</CardTitle>
          <CardDescription>
            Budget utilization, monitoring indicators, and donor-ready exports.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1.5"
            disabled={exporting !== null}
            onClick={handleUcDraft}
          >
            <FileText className="h-4 w-4" />
            {exporting === "uc" ? "Generating…" : "Generate UC draft"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1.5"
            disabled={exporting !== null}
            onClick={handleDonorPack}
          >
            <Download className="h-4 w-4" />
            {exporting === "donor" ? "Exporting…" : "Donor report pack"}
          </Button>
        </div>
      </div>

      {message && (
        <p className="mb-4 text-sm text-brand-teal">{message}</p>
      )}

      <div className="tab-bar-mobile mb-4 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors min-h-[44px] sm:px-4",
              tab === t.id
                ? "border-brand-teal text-brand-teal"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading project data…</p>
      ) : (
        <>
          {tab === "budget" && (
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <HelpTip helpKey="budget_head" />
                <span className="text-sm text-slate-500">Approved & pending expenses vs proposal budget</span>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Total budget</p>
                  <p className="text-lg font-bold tabular-nums">{formatBudgetCurrency(budget.totalBudget)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Spent</p>
                  <p className="text-lg font-bold tabular-nums text-brand-teal">
                    {formatBudgetCurrency(budget.totalSpent)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Utilization</p>
                  <p className="text-lg font-bold tabular-nums">{Math.round(budget.percentUsed)}%</p>
                </div>
              </div>

              {budget.rows.length === 0 ? (
                <p className="text-sm text-slate-500">No budget heads or expenses yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="pb-2 pr-3 font-semibold">Budget head</th>
                        <th className="pb-2 pr-3 font-semibold text-right">Budgeted</th>
                        <th className="pb-2 pr-3 font-semibold text-right">Spent</th>
                        <th className="pb-2 pr-3 font-semibold text-right">Remaining</th>
                        <th className="pb-2 font-semibold text-right">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {budget.rows.map((row) => (
                        <tr key={row.head}>
                          <td className="py-2.5 pr-3 font-medium text-brand-ink">{row.head}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {formatBudgetCurrency(row.budgeted)}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {formatBudgetCurrency(row.spent)}
                          </td>
                          <td
                            className={cn(
                              "py-2.5 pr-3 text-right tabular-nums",
                              row.remaining < 0 && "text-red-600"
                            )}
                          >
                            {formatBudgetCurrency(row.remaining)}
                          </td>
                          <td className="py-2.5 text-right">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                                row.status === "over"
                                  ? "bg-red-100 text-red-800"
                                  : row.status === "warning"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-800"
                              )}
                            >
                              {Math.round(row.percentUsed)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "me" && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <HelpTip helpKey="me_rag" />
                <span className="text-sm text-slate-500">KPI progress from milestone setup</span>
              </div>

              {meRows.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No M&E indicators configured. Complete milestone setup to track KPIs.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="pb-2 pr-3 font-semibold">Milestone</th>
                        <th className="pb-2 pr-3 font-semibold">Indicator</th>
                        <th className="pb-2 pr-3 font-semibold text-right">Target</th>
                        <th className="pb-2 pr-3 font-semibold text-right">Actual</th>
                        <th className="pb-2 pr-3 font-semibold text-right">%</th>
                        <th className="pb-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {meRows.map((row, i) => (
                        <tr key={`${row.milestoneName}-${row.kpiName}-${i}`}>
                          <td className="py-2.5 pr-3 text-slate-600">{row.milestoneName}</td>
                          <td className="py-2.5 pr-3 font-medium text-brand-ink">{row.kpiName}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{row.target}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{row.actual}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {Math.round(row.percentAchieved)}%
                          </td>
                          <td className="py-2.5">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                                RAG_STYLES[row.status]
                              )}
                            >
                              {RAG_LABELS[row.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "vault" && (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-500">MOU, audit reports, CSR documents</span>
                </div>
                <Label className="mb-0 cursor-pointer">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg bg-brand-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-teal-dark",
                      uploading && "pointer-events-none opacity-50"
                    )}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? "Uploading…" : "Upload"}
                  </span>
                  <Input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                      e.target.value = "";
                    }}
                  />
                </Label>
              </div>

              {documents.length === 0 ? (
                <p className="text-sm text-slate-500">No documents uploaded for this project.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-brand-ink">{doc.title}</p>
                        <p className="text-xs text-slate-500">
                          {doc.category} · {doc.uploadedBy.name} ·{" "}
                          {new Date(doc.createdAt).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">{doc.fileName}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
