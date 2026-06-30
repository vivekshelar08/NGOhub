"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  allocateMilestoneBeneficiaryTotal,
  capCatalogItemBeneficiaries,
  computeBudgetTotals,
  budgetAdminInputFromProject,
  computeMilestoneBudgetAmount,
  computeSetupTotals,
  createBlankCatalogItem,
  createBlankKpi,
  createBlankMilestone,
  formatINR,
  getMilestoneBeneficiaryCaps,
  getSetupWizardStepsForProjectType,
  initCatalogFromProposal,
  initSetupFromProposal,
  KpiTrackingMode,
  maxMilestoneBeneficiaryTotal,
  MilestoneBeneficiaryMode,
  MilestoneKPI,
  ProjectMilestone,
  ProjectProposal,
  ProjectSetup,
  remainingCatalogActivities,
  remainingCatalogBeneficiaries,
  SetupCatalogItem,
  sumCatalogBeneficiaries,
  upsertProject,
  validateCatalogStep,
  validateKpisStep,
  validateSetup,
} from "@/lib/projects";
import { getProjectTypeConfig, catalogShowsActivityCount, catalogShowsBeneficiaries, getAllowedKpiModes, getCatalogActivityFieldLabel } from "@/lib/projectMeta";

interface AssignableUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface MilestoneSetupWizardProps {
  project: ProjectProposal;
  basePath: "/dashboard/projects" | "/admin/projects";
  variant?: "light" | "dark";
  assignableUsers: AssignableUser[];
}

export function MilestoneSetupWizard({
  project: initialProject,
  basePath,
  variant = "light",
  assignableUsers,
}: MilestoneSetupWizardProps) {
  const router = useRouter();
  const isDark = variant === "dark";
  const [project, setProject] = useState(initialProject);
  const [setup, setSetup] = useState<ProjectSetup>(() => {
    const base = initialProject.setup ?? initSetupFromProposal(initialProject);
    return {
      ...base,
      catalog: base.catalog?.length ? base.catalog : initCatalogFromProposal(initialProject),
    };
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [activeMilestoneIndex, setActiveMilestoneIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const typeConfig = useMemo(
    () => getProjectTypeConfig(project.projectType),
    [project.projectType]
  );
  const setupSteps = useMemo(
    () => getSetupWizardStepsForProjectType(project.projectType),
    [project.projectType]
  );
  const showCatalogActivity = useMemo(
    () => catalogShowsActivityCount(project.projectType),
    [project.projectType]
  );
  const showCatalogBeneficiary = useMemo(
    () => catalogShowsBeneficiaries(project.projectType),
    [project.projectType]
  );
  const allowedKpiModes = useMemo(
    () => getAllowedKpiModes(project.projectType),
    [project.projectType]
  );
  const catalogActivityLabel = useMemo(
    () => getCatalogActivityFieldLabel(project.projectType),
    [project.projectType]
  );

  useEffect(() => {
    if (stepIndex >= setupSteps.length) {
      setStepIndex(Math.max(0, setupSteps.length - 1));
    }
  }, [setupSteps.length, stepIndex]);

  const step = setupSteps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === setupSteps.length - 1;

  const { totalEvaluation } = useMemo(
    () => computeBudgetTotals(project.budget, budgetAdminInputFromProject(project)),
    [project.budget]
  );

  const totals = useMemo(
    () =>
      computeSetupTotals(
        setup.milestones,
        totalEvaluation,
        project.totalBeneficiaries,
        setup.catalog
      ),
    [setup.milestones, setup.catalog, totalEvaluation, project.totalBeneficiaries]
  );

  const catalogBeneficiaryTotal = useMemo(
    () => sumCatalogBeneficiaries(setup.catalog),
    [setup.catalog]
  );

  const panel = isDark ? "border-slate-800 bg-slate-950/80" : "border-slate-200 bg-white shadow-sm";
  const section = isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white shadow-sm";
  const label = isDark ? "text-slate-500" : "text-slate-600";
  const titleText = isDark ? "text-white" : "text-slate-900";
  const muted = isDark ? "text-slate-500" : "text-slate-500";
  const border = isDark ? "border-slate-800" : "border-slate-200";
  const fieldClass = isDark
    ? "border-slate-700 bg-slate-900/80 text-slate-100 placeholder:text-slate-500 focus:border-brand-teal/50 focus:ring-brand-teal/30"
    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-brand-teal";

  function fieldClassName(className?: string) {
    return cn(
      "w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-1",
      fieldClass,
      className
    );
  }

  function saveProgress(currentSetup: ProjectSetup = setup) {
    try {
      upsertProject({ ...project, setup: currentSetup });
      setError(null);
      return true;
    } catch {
      setError("Could not save progress.");
      return false;
    }
  }

  function updateCatalogItem(id: string, patch: Partial<SetupCatalogItem>) {
    setSetup((prev) => ({
      ...prev,
      catalog: prev.catalog.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        if (patch.totalBeneficiaries !== undefined) {
          next.totalBeneficiaries = capCatalogItemBeneficiaries(
            prev.catalog,
            id,
            next.totalBeneficiaries,
            project.totalBeneficiaries
          );
        }
        return next;
      }),
    }));
  }

  function addCatalogItem() {
    if (typeConfig.maxActivities && setup.catalog.length >= typeConfig.maxActivities) return;
    setSetup((prev) => ({
      ...prev,
      catalog: [...prev.catalog, createBlankCatalogItem()],
    }));
  }

  function removeCatalogItem(id: string) {
    if (setup.catalog.length <= 1) return;
    setSetup((prev) => ({
      ...prev,
      catalog: prev.catalog.filter((c) => c.id !== id),
    }));
  }

  function importFromProposal() {
    const existing = new Set(setup.catalog.map((c) => c.sourceProposalActivityId).filter(Boolean));
    const toAdd = initCatalogFromProposal(project).filter(
      (c) => c.sourceProposalActivityId && !existing.has(c.sourceProposalActivityId)
    );
    if (toAdd.length === 0) return;
    setSetup((prev) => ({ ...prev, catalog: [...prev.catalog, ...toAdd] }));
  }

  function toggleSummaryCatalogItem(milestoneId: string, catalogItemId: string) {
    setSetup((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) => {
        if (m.id !== milestoneId) return m;
        const ids = m.beneficiarySummary.catalogItemIds;
        const isChecked = ids.includes(catalogItemId);
        if (!isChecked) {
          const remaining = remainingCatalogBeneficiaries(
            catalogItemId,
            prev.catalog,
            prev.milestones,
            { milestoneId }
          );
          if (remaining <= 0) return m;
        }
        const nextIds = isChecked
          ? ids.filter((id) => id !== catalogItemId)
          : [...ids, catalogItemId];
        const prunedIds = nextIds.filter(
          (id) =>
            remainingCatalogBeneficiaries(id, prev.catalog, prev.milestones, { milestoneId }) > 0
        );
        const maxTotal = maxMilestoneBeneficiaryTotal(prunedIds, prev.milestones, prev.catalog, milestoneId);
        return {
          ...m,
          beneficiarySummary: {
            ...m.beneficiarySummary,
            catalogItemIds: prunedIds,
            totalBeneficiaries: Math.min(m.beneficiarySummary.totalBeneficiaries, maxTotal),
          },
        };
      }),
    }));
  }

  function updateMilestoneSummary(
    milestoneId: string,
    patch: Partial<{ catalogItemIds: string[]; totalBeneficiaries: number }>
  ) {
    setSetup((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) => {
        if (m.id !== milestoneId) return m;
        const summary = { ...m.beneficiarySummary, ...patch };
        summary.catalogItemIds = summary.catalogItemIds.filter(
          (id) =>
            remainingCatalogBeneficiaries(id, prev.catalog, prev.milestones, { milestoneId }) > 0
        );
        const maxTotal = maxMilestoneBeneficiaryTotal(
          summary.catalogItemIds,
          prev.milestones,
          prev.catalog,
          milestoneId
        );
        if (summary.totalBeneficiaries > maxTotal) {
          summary.totalBeneficiaries = maxTotal;
        }
        return { ...m, beneficiarySummary: summary };
      }),
    }));
  }

  function updateMilestone(id: string, patch: Partial<ProjectMilestone>) {
    setSetup((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) => {
        if (m.id !== id) return m;
        const next = { ...m, ...patch };
        if (patch.beneficiaryMode === "milestone_total") {
          next.kpis = m.kpis.map((k) =>
            k.trackingMode === "beneficiaries" || k.trackingMode === "combined"
              ? { ...k, trackingMode: "activities" as const, beneficiaryCount: 0 }
              : k
          );
        }
        return next;
      }),
    }));
  }

  function addMilestone() {
    const index = setup.milestones.length + 1;
    setSetup((prev) => ({
      ...prev,
      milestones: [...prev.milestones, createBlankMilestone(index)],
    }));
    setActiveMilestoneIndex(setup.milestones.length);
  }

  function removeMilestone(id: string) {
    if (setup.milestones.length <= 1) return;
    setSetup((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((m) => m.id !== id),
    }));
    setActiveMilestoneIndex((i) => Math.max(0, i - 1));
  }

  function updateKpi(milestoneId: string, kpiId: string, patch: Partial<MilestoneKPI>) {
    setSetup((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) => {
        if (m.id !== milestoneId) return m;
        return {
          ...m,
          kpis: m.kpis.map((k) => {
            if (k.id !== kpiId) return k;
            const next = { ...k, ...patch };
            const catalogId = next.catalogItemId ?? k.catalogItemId;
            const exclude = { milestoneId, kpiId };

            if (patch.beneficiaryCount !== undefined && catalogId && m.beneficiaryMode === "inline") {
              const maxBen = remainingCatalogBeneficiaries(
                catalogId,
                prev.catalog,
                prev.milestones,
                exclude
              );
              next.beneficiaryCount = Math.min(Math.max(0, next.beneficiaryCount), maxBen);
            }

            if (patch.activityCount !== undefined && catalogId) {
              const maxAct = remainingCatalogActivities(
                catalogId,
                prev.catalog,
                prev.milestones,
                exclude
              );
              next.activityCount = Math.min(Math.max(0, next.activityCount), maxAct);
            }

            return next;
          }),
        };
      }),
    }));
  }


  function removeKpi(milestoneId: string, kpiId: string) {
    setSetup((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) =>
        m.id !== milestoneId ? m : { ...m, kpis: m.kpis.filter((k) => k.id !== kpiId) }
      ),
    }));
  }

  function addKpi(milestoneId: string) {
    const defaultMode = allowedKpiModes[0] ?? "activities";
    setSetup((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) =>
        m.id !== milestoneId ? m : { ...m, kpis: [...m.kpis, createBlankKpi(defaultMode)] }
      ),
    }));
  }

  function distributeBudgetEvenly() {
    const count = setup.milestones.length;
    if (count === 0) return;
    const base = Math.floor(100 / count);
    const remainder = 100 - base * count;
    setSetup((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m, i) => ({
        ...m,
        budgetPercent: base + (i === 0 ? remainder : 0),
      })),
    }));
  }

  function goNext() {
    setError(null);
    if (step.id === "catalog") {
      const err = validateCatalogStep(setup.catalog, project.totalBeneficiaries, project.projectType);
      if (err) {
        setError(err);
        return;
      }
    }
    if (step.id === "milestones") {
      if (setup.milestones.length === 0) {
        setError("Add at least one milestone.");
        return;
      }
      if (!totals.budgetPercentMatches) {
        setError(`Budget percentages must total 100% (currently ${totals.budgetPercentTotal}%).`);
        return;
      }
    }
    if (step.id === "kpis") {
      const err = validateKpisStep(setup, totalEvaluation, project.totalBeneficiaries, project.projectType);
      if (err) {
        setError(err);
        return;
      }
    }
    setStepIndex((i) => Math.min(i + 1, setupSteps.length - 1));
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function completeSetup() {
    const validationError = validateSetup(
      setup,
      totalEvaluation,
      project.totalBeneficiaries,
      project.projectType
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    const completedSetup: ProjectSetup = {
      ...setup,
      completedAt: new Date().toISOString(),
    };

    try {
      upsertProject({ ...project, setup: completedSetup });
      router.push(`${basePath}/${project.id}`);
    } catch {
      setError("Could not complete setup.");
    }
  }

  const coordinators = assignableUsers.filter((u) => u.role === "COORDINATOR" || u.role === "MANAGER");
  const teamPool = assignableUsers.filter((u) => u.role === "STAFF" || u.role === "COORDINATOR");
  const activeMilestone =
    setup.milestones[Math.min(activeMilestoneIndex, Math.max(0, setup.milestones.length - 1))];

  const milestoneBeneficiaryCap = useMemo(() => {
    if (!activeMilestone) return 0;
    return maxMilestoneBeneficiaryTotal(
      activeMilestone.beneficiarySummary.catalogItemIds,
      setup.milestones,
      setup.catalog,
      activeMilestone.id
    );
  }, [activeMilestone, setup.milestones, setup.catalog]);

  const milestoneBeneficiarySplit = useMemo(() => {
    if (!activeMilestone || activeMilestone.beneficiaryMode !== "milestone_total") return [];
    const ids = activeMilestone.beneficiarySummary.catalogItemIds;
    const total = activeMilestone.beneficiarySummary.totalBeneficiaries;
    if (ids.length === 0 || total <= 0) return [];
    const caps = getMilestoneBeneficiaryCaps(
      ids,
      setup.catalog,
      setup.milestones,
      activeMilestone.id
    );
    const shares = allocateMilestoneBeneficiaryTotal(ids, total, setup.catalog, caps);
    return ids.map((id) => {
      const item = setup.catalog.find((c) => c.id === id);
      const allotted = item?.totalBeneficiaries ?? 0;
      const share = shares.get(id) ?? 0;
      const remaining = caps.get(id) ?? 0;
      return { id, name: item?.name ?? "Unnamed", allotted, share, remaining };
    });
  }, [activeMilestone, setup.catalog, setup.milestones]);

  return (
    <div className="p-6 md:p-8">
      <Link
        href={basePath}
        className={cn(
          "mb-4 inline-flex items-center gap-1.5 text-sm transition-colors",
          isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all projects
      </Link>

      <section className={cn("mb-6 rounded-xl border p-4 md:p-5", panel)}>
        <p className={cn("text-xs font-medium uppercase tracking-widest", muted)}>
          Post-Approval Setup · {project.title}
        </p>
        <h1 className={cn("mt-1 text-xl font-bold md:text-2xl", titleText)}>
          Project planning
        </h1>
        <p className={cn("mt-1 text-sm font-medium", titleText)}>
          Step {stepIndex + 1} of {setupSteps.length}: {step.label}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {setupSteps.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                i < stepIndex
                  ? "bg-brand-teal/15 text-brand-teal-dark"
                  : i === stepIndex
                    ? "bg-brand-red text-white"
                    : isDark
                      ? "bg-slate-800 text-slate-400"
                      : "bg-slate-100 text-slate-500"
              )}
            >
              {i < stepIndex ? "✓ " : ""}{s.label}
            </span>
          ))}
        </div>
        <p className={cn("mt-3 text-sm", muted)}>{typeConfig.setupFlowHint}</p>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <SummaryChip
            label="Proposal Budget"
            value={`₹${formatINR(totalEvaluation)}`}
            ok={totals.budgetMatches}
            isDark={isDark}
          />
          {showCatalogBeneficiary && (
            <>
              <SummaryChip
                label="Catalog Totals"
                value={`${catalogBeneficiaryTotal.toLocaleString("en-IN")} ben${showCatalogActivity ? ` · ${totals.catalogActivityTotal} units` : ""}`}
                ok={catalogBeneficiaryTotal === project.totalBeneficiaries || project.totalBeneficiaries === 0}
                isDark={isDark}
              />
              <SummaryChip
                label="Beneficiaries"
                value={`${totals.totalBeneficiaries.toLocaleString("en-IN")} / ${catalogBeneficiaryTotal.toLocaleString("en-IN")}`}
                ok={totals.beneficiariesMatch}
                isDark={isDark}
              />
            </>
          )}
          {showCatalogActivity && !showCatalogBeneficiary && (
            <SummaryChip
              label="Catalog Units"
              value={`${totals.catalogActivityTotal} total`}
              ok={totals.catalogFullyAllocated}
              isDark={isDark}
            />
          )}
          <SummaryChip
            label="Splits"
            value={totals.catalogFullyAllocated ? "Matched" : "Pending"}
            ok={totals.catalogFullyAllocated}
            isDark={isDark}
          />
          <SummaryChip
            label="Budget %"
            value={`${totals.budgetPercentTotal}% / 100%`}
            ok={totals.budgetPercentMatches}
            isDark={isDark}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {setupSteps.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                i === stepIndex
                  ? "bg-brand-red text-white ring-2 ring-brand-teal/40"
                  : isDark
                    ? "bg-slate-800/80 text-slate-500"
                    : "bg-slate-100 text-slate-400"
              )}
            >
              <span>{i + 1}</span>
              {s.label}
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <section className={cn("rounded-xl border p-5 md:p-6", section)}>
        {step.id === "catalog" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={cn("text-sm", muted)}>
                {typeConfig.catalogMode === "phases"
                  ? "Define setup phases (e.g. land acquisition, equipment, launch). Split these across milestones in the next steps."
                  : typeConfig.catalogMode === "deliverables"
                    ? "List institutional deliverables (reports, trainings, outputs). Track completion via activity KPIs in milestones."
                    : typeConfig.catalogMode === "enrollment"
                      ? "Define enrollment targets or cohorts. Split beneficiary totals across period milestones in the next steps."
                      : typeConfig.catalogMode === "services"
                        ? "Define service delivery lines and beneficiary targets. Split across delivery milestones after approval."
                        : typeConfig.catalogMode === "single_event"
                          ? "Confirm the single event totals. These will be split across milestones in the next steps."
                          : "Define the master list of activities and beneficiary totals for this project. Import from the proposal or add new lines."}
              </p>
              <div className="flex flex-wrap gap-2">
                {project.activities.length > 0 && (
                  <Button type="button" variant="secondary" size="sm" onClick={importFromProposal}>
                    Import from Proposal
                  </Button>
                )}
                {(!typeConfig.maxActivities || setup.catalog.length < typeConfig.maxActivities) && (
                  <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={addCatalogItem}>
                    <Plus className="h-4 w-4" />
                    Add Line Item
                  </Button>
                )}
              </div>
            </div>

            {showCatalogBeneficiary && (
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-xs tabular-nums",
                catalogBeneficiaryTotal === project.totalBeneficiaries
                  ? isDark
                    ? "bg-brand-mist/10 text-brand-teal-light"
                    : "bg-brand-mist text-brand-teal-dark"
                  : isDark
                    ? "bg-amber-500/10 text-amber-300"
                    : "bg-amber-50 text-amber-700"
              )}
            >
              Catalog beneficiaries: {catalogBeneficiaryTotal.toLocaleString("en-IN")} /{" "}
              {project.totalBeneficiaries.toLocaleString("en-IN")} proposal target
              {showCatalogActivity && <> · Activity units: {totals.catalogActivityTotal}</>}
            </div>
            )}

            {setup.catalog.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-lg border p-4",
                  isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50"
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className={cn("text-xs font-semibold uppercase", label)}>
                    Line {index + 1}
                    {item.sourceProposalActivityId && (
                      <span className="ml-2 font-normal normal-case text-brand-teal">from proposal</span>
                    )}
                  </span>
                  {setup.catalog.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCatalogItem(item.id)}
                      className="text-red-500 hover:text-red-400"
                      aria-label="Remove line item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className={cn("mb-1 block text-xs font-medium", label)}>Name</label>
                    <input
                      value={item.name}
                      onChange={(e) => updateCatalogItem(item.id, { name: e.target.value })}
                      className={fieldClassName()}
                      placeholder="e.g. Digital Literacy Camp"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={cn("mb-1 block text-xs font-medium", label)}>Description</label>
                    <textarea
                      rows={2}
                      value={item.description}
                      onChange={(e) => updateCatalogItem(item.id, { description: e.target.value })}
                      className={fieldClassName("resize-y")}
                    />
                  </div>
                  {showCatalogActivity && (
                  <div>
                    <label className={cn("mb-1 block text-xs font-medium", label)}>{catalogActivityLabel}</label>
                    <input
                      type="number"
                      min={0}
                      value={item.totalActivityCount || ""}
                      onChange={(e) =>
                        updateCatalogItem(item.id, {
                          totalActivityCount: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className={fieldClassName()}
                      placeholder={
                        typeConfig.catalogMode === "deliverables" ? "e.g. 1 report" : "e.g. 10 camps"
                      }
                    />
                  </div>
                  )}
                  {showCatalogBeneficiary && (
                  <div>
                    <label className={cn("mb-1 block text-xs font-medium", label)}>Total beneficiaries</label>
                    <input
                      type="number"
                      min={0}
                      value={item.totalBeneficiaries || ""}
                      onChange={(e) =>
                        updateCatalogItem(item.id, {
                          totalBeneficiaries: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className={fieldClassName()}
                    />
                  </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {step.id === "milestones" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={cn("text-sm", muted)}>
                Create milestones and assign budget percentages. Activity and beneficiary splits come in the next step.
              </p>
              <div className="flex gap-2">
                {setup.milestones.length > 0 && (
                  <Button type="button" variant="secondary" size="sm" onClick={distributeBudgetEvenly}>
                    Split Evenly
                  </Button>
                )}
                <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={addMilestone}>
                  <Plus className="h-4 w-4" />
                  Add Milestone
                </Button>
              </div>
            </div>

            {setup.milestones.length === 0 ? (
              <p className={cn("rounded-lg border border-dashed p-8 text-center text-sm", border, muted)}>
                No milestones yet. Add at least one milestone to continue.
              </p>
            ) : (
              setup.milestones.map((milestone, index) => {
              const amount = computeMilestoneBudgetAmount(totalEvaluation, milestone.budgetPercent);
              return (
                <div
                  key={milestone.id}
                  className={cn(
                    "rounded-lg border p-4",
                    isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50"
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className={cn("text-xs font-semibold uppercase", label)}>
                      Milestone {index + 1}
                    </span>
                    {setup.milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMilestone(milestone.id)}
                        className="text-red-500 hover:text-red-400"
                        aria-label="Remove milestone"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <label className={cn("mb-1 block text-xs font-medium", label)}>Name</label>
                      <input
                        value={milestone.name}
                        onChange={(e) => updateMilestone(milestone.id, { name: e.target.value })}
                        className={fieldClassName()}
                        placeholder="e.g. Phase 1 — Outreach"
                      />
                    </div>
                    <div>
                      <label className={cn("mb-1 block text-xs font-medium", label)}>Budget %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        value={milestone.budgetPercent || ""}
                        onChange={(e) =>
                          updateMilestone(milestone.id, {
                            budgetPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          })
                        }
                        className={fieldClassName()}
                      />
                      <p className={cn("mt-1 text-xs tabular-nums", muted)}>₹{formatINR(amount)}</p>
                    </div>
                  </div>
                </div>
              );
            })
            )}
          </div>
        )}

        {step.id === "kpis" && (
          setup.milestones.length === 0 ? (
            <p className={cn("text-sm", muted)}>Add milestones in the previous step first.</p>
          ) : activeMilestone && (
          <div className="space-y-4">
            <p className={cn("text-sm", muted)}>
              {typeConfig.catalogMode === "deliverables"
                ? "Split deliverable counts across milestones. Use Activity KPIs to track completion."
                : typeConfig.catalogMode === "enrollment"
                  ? "Split enrollment targets across period milestones using Beneficiary KPIs."
                  : typeConfig.catalogMode === "services"
                    ? "Split service beneficiary targets across delivery milestones."
                    : "Split catalog totals into each milestone. Choose how beneficiaries are counted per milestone — on each KPI or one total line at the end."}
            </p>

            <div
              className={cn(
                "rounded-lg border p-4",
                isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-slate-50"
              )}
            >
              <p className={cn("mb-3 text-xs font-semibold uppercase", label)}>Catalog split progress</p>
              <div className="space-y-2">
                {totals.catalogRollups.map((rollup) => (
                  <div key={rollup.catalogItemId} className="text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={titleText}>{rollup.name || "Unnamed"}</span>
                      {rollup.sliceCount > 0 && (
                        <span className={cn("text-xs", muted)}>{rollup.sliceCount} KPI(s)</span>
                      )}
                    </div>
                    <div className={cn("mt-1 flex flex-wrap gap-4 text-xs tabular-nums", muted)}>
                      {showCatalogActivity && (
                        <span className={rollup.activitiesMatch ? "text-brand-teal" : "text-amber-600"}>
                          {typeConfig.catalogMode === "deliverables" ? "Deliverables" : "Activities"}:{" "}
                          {rollup.allocatedActivityCount} / {rollup.targetActivityCount}
                        </span>
                      )}
                      {showCatalogBeneficiary && (
                        <span className={rollup.beneficiariesMatch ? "text-brand-teal" : "text-amber-600"}>
                          Beneficiaries: {rollup.allocatedBeneficiaries.toLocaleString("en-IN")} /{" "}
                          {rollup.targetBeneficiaries.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b pb-3">
              {setup.milestones.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMilestoneIndex(i)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    i === activeMilestoneIndex
                      ? "bg-brand-red text-white"
                      : isDark
                        ? "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {m.name || `Milestone ${i + 1}`}
                  <span className="ml-1.5 text-xs opacity-75">
                    ({m.kpis.filter((k) => k.trackingMode === "activities" || k.trackingMode === "combined").length}{" "}
                    act
                    {m.beneficiaryMode === "milestone_total" ? " · total ben" : ""})
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={cn("text-xs", muted)}>
                {activeMilestone.kpis.length} KPI(s) · {activeMilestone.budgetPercent}% budget (₹
                {formatINR(computeMilestoneBudgetAmount(totalEvaluation, activeMilestone.budgetPercent))})
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={() => addKpi(activeMilestone.id)}
              >
                <Plus className="h-4 w-4" />
                Add KPI
              </Button>
            </div>

            {activeMilestone.kpis.length === 0 ? (
              <p className={cn("rounded-lg border border-dashed p-6 text-center text-sm", border, muted)}>
                No KPIs yet. Add a KPI and choose Activity or Beneficiary type.
              </p>
            ) : (
              activeMilestone.kpis.map((kpi, kpiIndex) => (
                <div
                  key={kpi.id}
                  className={cn(
                    "rounded-lg border p-4",
                    isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50"
                  )}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className={cn("text-xs font-semibold uppercase", label)}>KPI {kpiIndex + 1}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-lg border p-0.5">
                        {(
                          [
                            { value: "activities" as const, label: "Activity" },
                            { value: "beneficiaries" as const, label: "Beneficiary" },
                            { value: "combined" as const, label: "Both" },
                          ] as const
                        )
                          .filter((option) => allowedKpiModes.includes(option.value))
                          .filter(
                            (option) =>
                              option.value === "activities" ||
                              activeMilestone.beneficiaryMode === "inline"
                          )
                          .map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              updateKpi(activeMilestone.id, kpi.id, {
                                trackingMode: option.value as KpiTrackingMode,
                                beneficiaryCount:
                                  option.value === "beneficiaries" || option.value === "combined"
                                    ? kpi.beneficiaryCount
                                    : 0,
                                activityCount:
                                  option.value === "activities" || option.value === "combined"
                                    ? kpi.activityCount
                                    : 0,
                              })
                            }
                            className={cn(
                              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                              kpi.trackingMode === option.value
                                ? "bg-brand-red text-white"
                                : isDark
                                  ? "text-slate-400 hover:text-slate-200"
                                  : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeKpi(activeMilestone.id, kpi.id)}
                        className="text-red-500 hover:text-red-400"
                        aria-label="Remove KPI"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className={cn("mb-1 block text-xs font-medium", label)}>
                        Link to catalog line (optional)
                      </label>
                      <select
                        value={kpi.catalogItemId ?? ""}
                        onChange={(e) => {
                          const item = setup.catalog.find((c) => c.id === e.target.value);
                          updateKpi(activeMilestone.id, kpi.id, {
                            catalogItemId: e.target.value || undefined,
                            ...(item ? { name: item.name, description: item.description } : {}),
                          });
                        }}
                        className={fieldClassName()}
                      >
                        <option value="">Custom KPI (no catalog link)</option>
                        {setup.catalog.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name || "Unnamed"} ({c.totalActivityCount} act ·{" "}
                            {c.totalBeneficiaries.toLocaleString("en-IN")} ben)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className={cn("mb-1 block text-xs font-medium", label)}>KPI slice name</label>
                      <input
                        value={kpi.name}
                        onChange={(e) => updateKpi(activeMilestone.id, kpi.id, { name: e.target.value })}
                        className={fieldClassName()}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={cn("mb-1 block text-xs font-medium", label)}>Description</label>
                      <textarea
                        rows={2}
                        value={kpi.description}
                        onChange={(e) => updateKpi(activeMilestone.id, kpi.id, { description: e.target.value })}
                        className={fieldClassName("resize-y")}
                      />
                    </div>
                    {kpi.trackingMode === "beneficiaries" && activeMilestone.beneficiaryMode === "inline" ? (
                      <div>
                        <label className={cn("mb-1 block text-xs font-medium", label)}>
                          Beneficiaries in this milestone
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={kpi.beneficiaryCount || ""}
                          onChange={(e) =>
                            updateKpi(activeMilestone.id, kpi.id, {
                              beneficiaryCount: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className={fieldClassName()}
                        />
                        {kpi.catalogItemId && (
                          <p className={cn("mt-1 text-xs", muted)}>
                            Max{" "}
                            {remainingCatalogBeneficiaries(
                              kpi.catalogItemId,
                              setup.catalog,
                              setup.milestones,
                              { milestoneId: activeMilestone.id, kpiId: kpi.id }
                            ).toLocaleString("en-IN")}{" "}
                            remaining for this activity
                          </p>
                        )}
                      </div>
                    ) : kpi.trackingMode === "combined" && activeMilestone.beneficiaryMode === "inline" ? (
                      <>
                        <div>
                          <label className={cn("mb-1 block text-xs font-medium", label)}>
                            Activity count
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={kpi.activityCount || ""}
                            onChange={(e) =>
                              updateKpi(activeMilestone.id, kpi.id, {
                                activityCount: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className={fieldClassName()}
                            placeholder="e.g. 4 camps"
                          />
                          {kpi.catalogItemId && (
                            <p className={cn("mt-1 text-xs", muted)}>
                              Max{" "}
                              {remainingCatalogActivities(
                                kpi.catalogItemId,
                                setup.catalog,
                                setup.milestones,
                                { milestoneId: activeMilestone.id, kpiId: kpi.id }
                              ).toLocaleString("en-IN")}{" "}
                              remaining for this activity
                            </p>
                          )}
                        </div>
                        <div>
                          <label className={cn("mb-1 block text-xs font-medium", label)}>
                            Beneficiaries (same KPI)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={kpi.beneficiaryCount || ""}
                            onChange={(e) =>
                              updateKpi(activeMilestone.id, kpi.id, {
                                beneficiaryCount: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className={fieldClassName()}
                          />
                          {kpi.catalogItemId && (
                            <p className={cn("mt-1 text-xs", muted)}>
                              Max{" "}
                              {remainingCatalogBeneficiaries(
                                kpi.catalogItemId,
                                setup.catalog,
                                setup.milestones,
                                { milestoneId: activeMilestone.id, kpiId: kpi.id }
                              ).toLocaleString("en-IN")}{" "}
                              remaining for this activity
                            </p>
                          )}
                        </div>
                      </>
                    ) : kpi.trackingMode === "activities" ? (
                      <div>
                        <label className={cn("mb-1 block text-xs font-medium", label)}>
                          Activity count in this milestone
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={kpi.activityCount || ""}
                          onChange={(e) =>
                            updateKpi(activeMilestone.id, kpi.id, {
                              activityCount: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className={fieldClassName()}
                          placeholder="e.g. 4 camps"
                        />
                        {kpi.catalogItemId && (
                          <p className={cn("mt-1 text-xs", muted)}>
                            Max{" "}
                            {remainingCatalogActivities(
                              kpi.catalogItemId,
                              setup.catalog,
                              setup.milestones,
                              { milestoneId: activeMilestone.id, kpiId: kpi.id }
                            ).toLocaleString("en-IN")}{" "}
                            remaining for this activity
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}

            {showCatalogBeneficiary && (
            <div
              className={cn(
                "rounded-lg border p-4",
                isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50"
              )}
            >
              <p className={cn("mb-3 text-xs font-semibold uppercase", label)}>
                Milestone beneficiary tracking
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                {(
                  [
                    {
                      value: "inline" as MilestoneBeneficiaryMode,
                      label: "On each KPI (incl. combined with activity)",
                    },
                    {
                      value: "milestone_total" as MilestoneBeneficiaryMode,
                      label: "One total line at end of milestone",
                    },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      updateMilestone(activeMilestone.id, { beneficiaryMode: option.value })
                    }
                    className={cn(
                      "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                      activeMilestone.beneficiaryMode === option.value
                        ? "bg-brand-red text-white"
                        : isDark
                          ? "bg-slate-800 text-slate-400 hover:bg-slate-700"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {activeMilestone.beneficiaryMode === "milestone_total" ? (
                <div className="space-y-4">
                  <p className={cn("text-xs", muted)}>
                    Select which activities this milestone&apos;s beneficiary total covers, then enter the total
                    count for this milestone.
                  </p>
                  <div>
                    <label className={cn("mb-2 block text-xs font-medium", label)}>Activities (multiselect)</label>
                    <div className="space-y-2">
                      {setup.catalog.map((item) => {
                        const checked = activeMilestone.beneficiarySummary.catalogItemIds.includes(item.id);
                        const itemRemaining = remainingCatalogBeneficiaries(
                          item.id,
                          setup.catalog,
                          setup.milestones,
                          { milestoneId: activeMilestone.id }
                        );
                        const disabled = !checked && itemRemaining <= 0;
                        return (
                          <label
                            key={item.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                              border,
                              disabled
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer",
                              checked
                                ? isDark
                                  ? "border-brand-teal/50 bg-brand-mist/10"
                                  : "border-brand-teal/30 bg-brand-mist"
                                : !disabled &&
                                    (isDark ? "hover:bg-slate-800/50" : "hover:bg-slate-50")
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleSummaryCatalogItem(activeMilestone.id, item.id)}
                              className="h-4 w-4 rounded border-slate-300 text-brand-teal disabled:cursor-not-allowed"
                            />
                            <span className={titleText}>
                              {item.name || "Unnamed"}
                              <span className={cn("ml-2 text-xs font-normal", muted)}>
                                {item.totalBeneficiaries.toLocaleString("en-IN")} allotted ·{" "}
                                {itemRemaining.toLocaleString("en-IN")} left
                                {disabled ? " (full)" : ""}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className={cn("mb-1 block text-xs font-medium", label)}>
                      Total beneficiaries this milestone
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={milestoneBeneficiaryCap}
                      value={activeMilestone.beneficiarySummary.totalBeneficiaries || ""}
                      onChange={(e) =>
                        updateMilestoneSummary(activeMilestone.id, {
                          totalBeneficiaries: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className={fieldClassName()}
                    />
                    <p className={cn("mt-1 text-xs", muted)}>
                      Max {milestoneBeneficiaryCap.toLocaleString("en-IN")} for selected activities
                      {milestoneBeneficiaryCap > 0
                        ? " (distributed proportionally among activities with capacity)"
                        : " — uncheck full activities or free capacity in other milestones"}
                    </p>
                    {milestoneBeneficiarySplit.length > 0 && (
                      <div className={cn("mt-3 rounded-lg border px-3 py-2 text-xs", border)}>
                        <p className={cn("mb-1 font-medium", label)}>Distribution preview</p>
                        <ul className="space-y-1 tabular-nums">
                          {milestoneBeneficiarySplit.map((row) => (
                            <li key={row.id} className={muted}>
                              {row.name}: {row.share.toLocaleString("en-IN")} of {row.allotted.toLocaleString("en-IN")}{" "}
                              allotted ({row.remaining.toLocaleString("en-IN")} unallocated across milestones)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className={cn("text-xs", muted)}>
                  Use Beneficiary or Both on individual KPIs above to count beneficiaries per activity line.
                </p>
              )}
            </div>
            )}
          </div>
          )
        )}

        {step.id === "staff" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Users className={cn("h-5 w-5", muted)} />
              <p className={cn("text-sm", muted)}>
                Assign a coordinator and their team to run this project on the ground.
              </p>
            </div>

            <div>
              <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                Project Coordinator
              </label>
              <select
                value={setup.staff.coordinatorId}
                onChange={(e) =>
                  setSetup((prev) => ({
                    ...prev,
                    staff: { ...prev.staff, coordinatorId: e.target.value },
                  }))
                }
                className={fieldClassName()}
              >
                <option value="">Select coordinator…</option>
                {coordinators.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={cn("mb-2 block text-xs font-medium uppercase tracking-wide", label)}>
                Team Members
              </label>
              {teamPool.length === 0 ? (
                <p className={cn("text-sm", muted)}>No staff users available. Create users in Admin first.</p>
              ) : (
                <div className="space-y-2">
                  {teamPool.map((user) => {
                    const checked = setup.staff.teamMemberIds.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
                          border,
                          checked
                            ? isDark
                              ? "border-brand-teal/50 bg-brand-mist/10"
                              : "border-brand-teal/30 bg-brand-mist"
                            : isDark
                              ? "hover:bg-slate-800/50"
                              : "hover:bg-slate-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSetup((prev) => ({
                              ...prev,
                              staff: {
                                ...prev.staff,
                                teamMemberIds: checked
                                  ? prev.staff.teamMemberIds.filter((id) => id !== user.id)
                                  : [...prev.staff.teamMemberIds, user.id],
                              },
                            }));
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                        />
                        <div>
                          <p className={cn("text-sm font-medium", titleText)}>{user.name}</p>
                          <p className={cn("text-xs", muted)}>
                            {user.role} · {user.email}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {step.id === "review" && (
          <div className="space-y-6">
            <p className={cn("text-sm", muted)}>
              Review milestone setup. All totals must match the approved proposal before activation.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              <ReviewBlock
                label="Budget Allocation"
                value={`₹${formatINR(totals.allocatedBudget)} / ₹${formatINR(totalEvaluation)}`}
                ok={totals.budgetMatches}
                isDark={isDark}
              />
              <ReviewBlock
                label="Beneficiaries"
                value={`${totals.totalBeneficiaries.toLocaleString("en-IN")} / ${project.totalBeneficiaries.toLocaleString("en-IN")}`}
                ok={totals.beneficiariesMatch}
                isDark={isDark}
              />
              <ReviewBlock
                label="Catalog Splits"
                value={totals.catalogFullyAllocated ? "All matched" : "Needs adjustment"}
                ok={totals.catalogFullyAllocated}
                isDark={isDark}
              />
            </div>

            <div
              className={cn(
                "rounded-lg border p-4",
                isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-slate-50"
              )}
            >
              <p className={cn("mb-2 text-xs font-medium uppercase", label)}>Master catalog</p>
              <ul className={cn("space-y-2 text-sm", muted)}>
                {setup.catalog.map((c) => {
                  const rollup = totals.catalogRollups.find((r) => r.catalogItemId === c.id);
                  return (
                    <li key={c.id}>
                      <span className={titleText}>{c.name}</span>
                      <span className="ml-2 tabular-nums text-xs">
                        {rollup?.allocatedActivityCount ?? 0}/{c.totalActivityCount} act ·{" "}
                        {(rollup?.allocatedBeneficiaries ?? 0).toLocaleString("en-IN")}/
                        {c.totalBeneficiaries.toLocaleString("en-IN")} ben
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {setup.milestones.map((m, i) => (
              <div
                key={m.id}
                className={cn("rounded-lg border p-4", isDark ? "border-slate-800" : "border-slate-200")}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={cn("font-semibold", titleText)}>
                    {i + 1}. {m.name}
                    <span className={cn("ml-2 text-xs font-normal", muted)}>
                      ({m.kpis.filter((k) => k.trackingMode === "activities" || k.trackingMode === "combined").length}{" "}
                      activity KPIs
                      {m.beneficiaryMode === "milestone_total" ? " · milestone total ben" : ""})
                    </span>
                  </p>
                  <span className={cn("text-sm tabular-nums", muted)}>
                    {m.budgetPercent}% · ₹{formatINR(computeMilestoneBudgetAmount(totalEvaluation, m.budgetPercent))}
                  </span>
                </div>
                <ul className={cn("mt-3 space-y-1 text-sm", muted)}>
                  {m.kpis.map((k) => (
                    <li key={k.id} className="flex justify-between gap-4">
                      <span>
                        {k.name}
                        {k.catalogItemId && (
                          <span className="ml-1 text-xs text-brand-teal">↗ catalog</span>
                        )}
                      </span>
                      <span className="tabular-nums">
                        {k.trackingMode === "beneficiaries"
                          ? `${k.beneficiaryCount.toLocaleString("en-IN")} beneficiaries`
                          : k.trackingMode === "combined"
                            ? `${k.activityCount} act · ${k.beneficiaryCount.toLocaleString("en-IN")} ben`
                            : `${k.activityCount} activities`}
                      </span>
                    </li>
                  ))}
                  {m.beneficiaryMode === "milestone_total" && (
                    <li className="flex justify-between gap-4 border-t pt-2 font-medium">
                      <span>
                        Milestone beneficiary total
                        {m.beneficiarySummary.catalogItemIds.length > 0 && (
                          <span className={cn("ml-1 text-xs font-normal", muted)}>
                            ({m.beneficiarySummary.catalogItemIds.length} activities)
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums">
                        {m.beneficiarySummary.totalBeneficiaries.toLocaleString("en-IN")} beneficiaries
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            ))}

            <div className={cn("rounded-lg border p-4", isDark ? "border-slate-800" : "border-slate-200")}>
              <p className={cn("text-xs font-medium uppercase", label)}>Staff</p>
              <p className={cn("mt-2 text-sm", titleText)}>
                Coordinator:{" "}
                {assignableUsers.find((u) => u.id === setup.staff.coordinatorId)?.name ?? "—"}
              </p>
              <p className={cn("mt-1 text-sm", muted)}>
                Team:{" "}
                {setup.staff.teamMemberIds.length === 0
                  ? "None"
                  : setup.staff.teamMemberIds
                      .map((id) => assignableUsers.find((u) => u.id === id)?.name)
                      .filter(Boolean)
                      .join(", ")}
              </p>
            </div>
          </div>
        )}

        <div className={cn("mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-6", border)}>
          <div className="flex gap-2">
            {!isFirst && (
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (saveProgress()) router.push(basePath);
              }}
            >
              Save & Exit
            </Button>
          </div>

          <div>
            {!isLast ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-red px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-red-dark"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Button type="button" variant="primary" size="md" className="gap-1.5" onClick={completeSetup}>
                <CheckCircle className="h-4 w-4" />
                Activate Project
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  ok,
  isDark,
}: {
  label: string;
  value: string;
  ok: boolean;
  isDark: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2 text-xs",
        ok
          ? isDark
            ? "bg-brand-mist/10 text-brand-teal-light"
            : "bg-brand-mist text-brand-teal-dark"
          : isDark
            ? "bg-amber-500/10 text-amber-300"
            : "bg-amber-50 text-amber-700"
      )}
    >
      <span className="font-medium">{label}: </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function ReviewBlock({
  label,
  value,
  ok,
  isDark,
}: {
  label: string;
  value: string;
  ok: boolean;
  isDark: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        ok
          ? isDark
            ? "border-brand-teal/30 bg-brand-mist/5"
            : "border-brand-teal/25 bg-brand-mist"
          : isDark
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-amber-200 bg-amber-50"
      )}
    >
      <p className={cn("text-xs font-medium uppercase", isDark ? "text-slate-400" : "text-slate-500")}>{label}</p>
      <p className={cn("mt-1 text-sm font-semibold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
        {value}
      </p>
    </div>
  );
}
