"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  ADMIN_OVERHEAD_RATE,
  budgetAdminInputFromProject,
  capActivityBeneficiaryTarget,
  computeBudgetLineTotal,
  computeBudgetTotals,
  createBlankActivity,
  createBlankBudgetCategory,
  createBlankBudgetLineItem,
  DEFAULT_ADMIN_OVERHEAD_PERCENT,
  formatINR,
  getProposalEditCount,
  getWizardStepsForProjectType,
  INTERVENTION_OPTIONS,
  MAX_PROPOSAL_EDITS_AFTER_APPROVAL,
  ProjectActivity,
  ProjectProposal,
  sumActivityBeneficiaryTargets,
  upsertProject,
  WIZARD_STEPS,
} from "@/lib/projects";
import { formatSdgList } from "@/lib/sdg";
import { DonorSelector } from "@/components/projects/DonorSelector";
import { ProposalExportActions } from "@/components/projects/ProposalExportActions";
import { SdgSelector } from "@/components/projects/SdgSelector";
import {
  formatProjectFundingType,
  formatProjectLocationScope,
  formatProjectType,
  fundingTypeRequiresDonor,
  getProjectTypeConfig,
  INDIAN_STATES_AND_UTS,
  PROJECT_FUNDING_TYPES,
  PROJECT_LOCATION_SCOPES,
  PROJECT_TYPES,
  ProjectType,
} from "@/lib/projectMeta";
import { resolveDonorLabels, loadDonors } from "@/lib/donors";

interface ProjectProposalWizardProps {
  initialProject: ProjectProposal;
  basePath: "/dashboard/projects" | "/admin/projects";
  variant?: "light" | "dark";
}

function ExcludeAdminToggle({
  checked,
  onChange,
  isDark,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  isDark: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Exclude admin cost"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-brand-mist/80" : isDark ? "bg-slate-700" : "bg-slate-300"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

export function ProjectProposalWizard({
  initialProject,
  basePath,
  variant = "light",
}: ProjectProposalWizardProps) {
  const router = useRouter();
  const isDark = variant === "dark";
  const [project, setProject] = useState<ProjectProposal>(initialProject);
  const [stepIndex, setStepIndex] = useState(0);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeConfig = useMemo(
    () => getProjectTypeConfig(project.projectType),
    [project.projectType]
  );
  const wizardSteps = useMemo(
    () => getWizardStepsForProjectType(project.projectType),
    [project.projectType]
  );

  useEffect(() => {
    if (stepIndex >= wizardSteps.length) {
      setStepIndex(Math.max(0, wizardSteps.length - 1));
    }
  }, [wizardSteps.length, stepIndex]);

  const step = wizardSteps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === wizardSteps.length - 1;

  const isApprovedEdit = project.status === "APPROVED";

  const { directSubtotal, adminOverhead, totalEvaluation, adminEligibleSubtotal } = useMemo(
    () => computeBudgetTotals(project.budget, budgetAdminInputFromProject(project)),
    [project.budget, project.adminOverheadPercent, project.adminOverheadAmount]
  );

  const activityBeneficiaryTotal = useMemo(
    () => sumActivityBeneficiaryTargets(project.activities),
    [project.activities]
  );

  const panel = isDark ? "border-slate-800 bg-slate-950/80" : "border-slate-200 bg-white shadow-sm";
  const section = isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white shadow-sm";
  const heading = isDark ? "text-slate-300" : "text-slate-700";
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

  function patchProject(patch: Partial<ProjectProposal>) {
    setProject((prev) => ({ ...prev, ...patch }));
  }

  function persistProject(current: ProjectProposal, status: ProjectProposal["status"]) {
    const totals = computeBudgetTotals(current.budget, budgetAdminInputFromProject(current));
    upsertProject({
      ...current,
      status,
      adminOverheadPercent: current.adminOverheadPercent ?? DEFAULT_ADMIN_OVERHEAD_PERCENT,
      adminOverheadAmount: current.adminOverheadAmount ?? totals.adminOverhead,
      totalEvaluation: totals.totalEvaluation,
    });
  }

  function saveDraft(current: ProjectProposal = project) {
    try {
      persistProject(current, isApprovedEdit ? "APPROVED" : "DRAFT");
      setError(null);
      return true;
    } catch {
      setError("Could not save draft. Check browser storage settings.");
      return false;
    }
  }

  function validateStepBeforeNext(
    stepId: (typeof WIZARD_STEPS)[number]["id"],
    current: ProjectProposal
  ): string | null {
    const config = getProjectTypeConfig(current.projectType);
    const totalBen = Number(current.totalBeneficiaries) || 0;

    if (stepId === "basics") {
      if (!current.title.trim()) return "Title of intervention is required.";
      if (!current.applicantName.trim()) return "Applicant name is required.";
      if (!current.location.trim()) return "Location is required.";
      if (!current.state?.trim()) return "Select a state before continuing.";
      const scope = current.locationScope ?? "single";
      if (scope === "single" && !current.district?.trim()) {
        return "Enter the district before continuing.";
      }
      if (scope !== "single" && !current.coverageAreas?.trim()) {
        return scope === "multi_state"
          ? "List the states covered before continuing."
          : "List the districts covered before continuing.";
      }
      if (config.requireBeneficiaryTarget && totalBen <= 0) {
        return "Enter target beneficiaries before continuing.";
      }
      return null;
    }

    if (stepId === "plan") {
      if (config.requireActivitiesInProposal) {
        if (current.activities.length === 0) return "Add at least one activity.";
        if (config.maxActivities && current.activities.length > config.maxActivities) {
          return `This project type allows at most ${config.maxActivities} activity.`;
        }
        const invalidActivity = current.activities.find((a) => !a.name.trim());
        if (invalidActivity) return "Each activity must have a name.";
        if (config.requireBeneficiaryTarget) {
          const activityBenTotal = sumActivityBeneficiaryTargets(current.activities);
          if (activityBenTotal !== totalBen) {
            return `Activity beneficiary targets (${activityBenTotal.toLocaleString("en-IN")}) must equal project total (${totalBen.toLocaleString("en-IN")}).`;
          }
        }
      }
      return null;
    }

    return null;
  }

  function validateForSubmit(current: ProjectProposal): string | null {
    const config = getProjectTypeConfig(current.projectType);
    if (!current.title.trim()) return "Title of intervention is required before submit.";
    if (!current.applicantName.trim()) return "Applicant name is required before submit.";
    if (!current.location.trim()) return "Location is required before submit.";
    const totalBen = Number(current.totalBeneficiaries) || 0;
    if (config.requireBeneficiaryTarget && totalBen <= 0) {
      return "Target beneficiaries is required before submit.";
    }
    if (config.requireActivitiesInProposal) {
      const activityBenTotal = sumActivityBeneficiaryTargets(current.activities);
      if (config.requireBeneficiaryTarget && activityBenTotal !== totalBen) {
        return `Activity beneficiary targets (${activityBenTotal.toLocaleString("en-IN")}) must equal project total (${totalBen.toLocaleString("en-IN")}).`;
      }
      if (current.activities.length === 0) return "Add at least one activity before submit.";
      if (config.maxActivities && current.activities.length > config.maxActivities) {
        return `This project type allows at most ${config.maxActivities} activity.`;
      }
      const invalidActivity = current.activities.find((a) => !a.name.trim());
      if (invalidActivity) return "Each activity must have a name before submit.";
    }
    if ((current.sdgGoals ?? []).length === 0) {
      return "Select at least one SDG goal before submit.";
    }
    if (!current.state?.trim()) return "Select a state before submit.";
    const scope = current.locationScope ?? "single";
    if (scope === "single" && !current.district?.trim()) {
      return "Enter the district before submit.";
    }
    if (scope !== "single" && !current.coverageAreas?.trim()) {
      return scope === "multi_state"
        ? "List the states covered before submit."
        : "List the districts covered before submit.";
    }
    if (fundingTypeRequiresDonor(current.fundingType) && (current.donorIds ?? []).length === 0) {
      return `Link at least one donor for ${formatProjectFundingType(current.fundingType)} projects.`;
    }
    return null;
  }

  function goNext() {
    setError(null);
    const stepError = validateStepBeforeNext(step.id, project);
    if (stepError) {
      setError(stepError);
      return;
    }
    setStepIndex((i) => Math.min(i + 1, wizardSteps.length - 1));
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function submitProposal() {
    const validationError = validateForSubmit(project);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      if (isApprovedEdit) {
        persistProject(project, "APPROVED");
      } else {
        persistProject(project, "SUBMITTED");
      }
      router.push(isApprovedEdit ? `${basePath}/${project.id}` : basePath);
    } catch {
      setError(isApprovedEdit ? "Could not save changes." : "Could not submit proposal.");
    }
  }

  function updateAdminPercent(percent: number) {
    const nextPercent = Math.max(0, Math.min(100, percent));
    setProject((prev) => {
      const totals = computeBudgetTotals(prev.budget, { adminOverheadPercent: nextPercent });
      return {
        ...prev,
        adminOverheadPercent: nextPercent,
        adminOverheadAmount: totals.adminOverhead,
      };
    });
  }

  function updateAdminAmount(amount: number) {
    patchProject({ adminOverheadAmount: Math.max(0, amount) });
  }

  function updateBudgetItem(
    categoryId: string,
    itemId: string,
    patch: Partial<{
      label: string;
      quantity: number;
      duration: number;
      amount: number;
      excludeAdminCost: boolean;
    }>
  ) {
    setProject((prev) => {
      const budget = prev.budget.map((category) =>
        category.id !== categoryId
          ? category
          : {
              ...category,
              items: category.items.map((item) =>
                item.id !== itemId ? item : { ...item, ...patch }
              ),
            }
      );
      const percent = prev.adminOverheadPercent ?? DEFAULT_ADMIN_OVERHEAD_PERCENT;
      const totals = computeBudgetTotals(budget, { adminOverheadPercent: percent });
      return {
        ...prev,
        budget,
        adminOverheadAmount: totals.adminOverhead,
      };
    });
  }

  function updateBudgetHead(categoryId: string, title: string) {
    setProject((prev) => ({
      ...prev,
      budget: prev.budget.map((c) => (c.id === categoryId ? { ...c, title } : c)),
    }));
  }

  function addBudgetHead() {
    setProject((prev) => ({
      ...prev,
      budget: [...prev.budget, createBlankBudgetCategory()],
    }));
  }

  function removeBudgetHead(categoryId: string) {
    if (project.budget.length <= 1) return;
    setProject((prev) => {
      const budget = prev.budget.filter((c) => c.id !== categoryId);
      const percent = prev.adminOverheadPercent ?? DEFAULT_ADMIN_OVERHEAD_PERCENT;
      const totals = computeBudgetTotals(budget, { adminOverheadPercent: percent });
      return { ...prev, budget, adminOverheadAmount: totals.adminOverhead };
    });
  }

  function addBudgetSubhead(categoryId: string) {
    setProject((prev) => ({
      ...prev,
      budget: prev.budget.map((c) =>
        c.id === categoryId ? { ...c, items: [...c.items, createBlankBudgetLineItem()] } : c
      ),
    }));
  }

  function removeBudgetSubhead(categoryId: string, itemId: string) {
    const category = project.budget.find((c) => c.id === categoryId);
    if (!category || category.items.length <= 1) return;
    setProject((prev) => {
      const budget = prev.budget.map((c) =>
        c.id === categoryId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c
      );
      const percent = prev.adminOverheadPercent ?? DEFAULT_ADMIN_OVERHEAD_PERCENT;
      const totals = computeBudgetTotals(budget, { adminOverheadPercent: percent });
      return { ...prev, budget, adminOverheadAmount: totals.adminOverhead };
    });
  }

  function updateActivity(id: string, patch: Partial<ProjectActivity>) {
    setProject((prev) => ({
      ...prev,
      activities: prev.activities.map((activity) => {
        if (activity.id !== id) return activity;
        const next = { ...activity, ...patch };
        if (patch.targetBeneficiaries !== undefined) {
          next.targetBeneficiaries = capActivityBeneficiaryTarget(
            prev.activities,
            id,
            next.targetBeneficiaries ?? 0,
            Number(prev.totalBeneficiaries) || 0
          );
        }
        return next;
      }),
    }));
  }

  function addActivity() {
    const config = getProjectTypeConfig(project.projectType);
    if (config.maxActivities && project.activities.length >= config.maxActivities) return;
    setProject((prev) => ({
      ...prev,
      activities: [...prev.activities, createBlankActivity()],
    }));
  }

  function setProjectType(nextType: ProjectType) {
    const config = getProjectTypeConfig(nextType);
    setProject((prev) => {
      let activities = prev.activities;
      if (config.skipActivitiesStep) {
        activities = [];
      } else if (config.maxActivities === 1) {
        activities = activities.length > 0 ? [activities[0]] : [createBlankActivity()];
      } else if (activities.length === 0) {
        activities = [createBlankActivity()];
      }
      return { ...prev, projectType: nextType, activities };
    });
  }

  function removeActivity(id: string) {
    setProject((prev) => ({
      ...prev,
      activities: prev.activities.filter((activity) => activity.id !== id),
    }));
  }

  function categorySubtotal(categoryId: string) {
    const category = project.budget.find((c) => c.id === categoryId);
    return category?.items.reduce((sum, item) => sum + computeBudgetLineTotal(item), 0) ?? 0;
  }

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
          New Intervention Proposal
        </p>
        <h1 className={cn("mt-1 text-xl font-bold md:text-2xl", titleText)}>
          Step {stepIndex + 1} of {wizardSteps.length}: {step.label}
        </h1>
        {isApprovedEdit && (
          <p className={cn("mt-2 text-sm text-amber-600 dark:text-amber-400")}>
            Editing approved proposal · {getProposalEditCount(project)}/{MAX_PROPOSAL_EDITS_AFTER_APPROVAL} edits
            used
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {wizardSteps.map((s, i) => {
            const active = i === stepIndex;
            return (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-brand-red text-white ring-2 ring-brand-teal/40"
                    : isDark
                      ? "bg-slate-800/80 text-slate-500"
                      : "bg-slate-100 text-slate-400"
                )}
              >
                <span>{i + 1}</span>
                {s.label}
              </div>
            );
          })}
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <section className={cn("rounded-xl border p-5 md:p-6", section)}>
        {step.id === "basics" && (
          <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                Project type
              </label>
              <p className={cn("mb-3 text-xs", muted)}>
                Choose the operating model — this controls which modules (activities, services, setup) apply.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROJECT_TYPES.map((option) => {
                  const selected = project.projectType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setProjectType(option.value)}
                      className={cn(
                        "rounded-lg border px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-brand-teal bg-brand-mist/10 ring-1 ring-brand-teal/30"
                          : isDark
                            ? "border-slate-700 hover:border-slate-600"
                            : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <p
                        className={cn(
                          "text-sm font-medium",
                          selected ? "text-brand-teal dark:text-brand-teal-light" : titleText
                        )}
                      >
                        {option.label}
                      </p>
                      <p className={cn("mt-0.5 text-xs", muted)}>{option.description}</p>
                    </button>
                  );
                })}
              </div>
              <p
                className={cn(
                  "mt-3 rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
                  isDark
                    ? "border-brand-teal/30 bg-brand-mist/5 text-brand-teal-light"
                    : "border-brand-teal/25 bg-brand-mist text-brand-teal-dark"
                )}
              >
                <span className="font-semibold">{typeConfig.label} flow: </span>
                {typeConfig.proposalFlowHint}
              </p>
            </div>
            <div className="md:col-span-2">
              <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                Title of Intervention
              </label>
              <input
                type="text"
                value={project.title}
                onChange={(e) => patchProject({ title: e.target.value })}
                className={fieldClassName()}
              />
            </div>
            <div>
              <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                Location(s)
              </label>
              <input
                type="text"
                value={project.location}
                onChange={(e) => patchProject({ location: e.target.value })}
                className={fieldClassName()}
              />
            </div>
            <div>
              <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                Applicant Name
              </label>
              <input
                type="text"
                value={project.applicantName}
                onChange={(e) => patchProject({ applicantName: e.target.value })}
                className={fieldClassName()}
              />
            </div>
            <div>
              <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                Project funding type
              </label>
              <select
                value={project.fundingType ?? "CSR"}
                onChange={(e) =>
                  patchProject({
                    fundingType: e.target.value as ProjectProposal["fundingType"],
                  })
                }
                className={fieldClassName()}
              >
                {PROJECT_FUNDING_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} — {option.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                State (reporting)
              </label>
              <select
                value={project.state ?? ""}
                onChange={(e) => patchProject({ state: e.target.value })}
                className={fieldClassName()}
              >
                <option value="">— Select state —</option>
                {INDIAN_STATES_AND_UTS.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                District
              </label>
              <input
                type="text"
                value={project.district ?? ""}
                onChange={(e) => patchProject({ district: e.target.value })}
                className={fieldClassName()}
                placeholder="e.g. Mumbai Suburban"
                disabled={project.locationScope === "multi_state"}
              />
              {project.locationScope === "multi_state" && (
                <p className={cn("mt-1 text-xs", muted)}>
                  Primary district is optional for multi-state projects — list all states below.
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className={cn("mb-2 block text-xs font-medium uppercase tracking-wide", label)}>
                Geographic scope
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                {PROJECT_LOCATION_SCOPES.map((option) => {
                  const selected = (project.locationScope ?? "single") === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        patchProject({
                          locationScope: option.value,
                          coverageAreas: option.value === "single" ? "" : project.coverageAreas,
                        })
                      }
                      className={cn(
                        "rounded-lg border px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-brand-teal bg-brand-mist/10 ring-1 ring-brand-teal/30"
                          : isDark
                            ? "border-slate-700 hover:border-slate-600"
                            : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <p className={cn("text-sm font-medium", selected ? "text-brand-teal dark:text-brand-teal-light" : titleText)}>
                        {option.label}
                      </p>
                      <p className={cn("mt-0.5 text-xs", muted)}>{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            {(project.locationScope ?? "single") !== "single" && (
              <div className="md:col-span-2">
                <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                  {project.locationScope === "multi_state" ? "States covered" : "Districts covered"}
                </label>
                <textarea
                  rows={3}
                  value={project.coverageAreas ?? ""}
                  onChange={(e) => patchProject({ coverageAreas: e.target.value })}
                  className={fieldClassName("resize-y")}
                  placeholder={
                    project.locationScope === "multi_state"
                      ? "e.g. Maharashtra, Gujarat, Karnataka (one per line or comma-separated)"
                      : "e.g. Mumbai Suburban, Thane, Palghar (one per line or comma-separated)"
                  }
                />
              </div>
            )}
            <div>
              <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                Intervention Nature
              </label>
              <select
                value={project.interventionNature}
                onChange={(e) => patchProject({ interventionNature: e.target.value })}
                className={fieldClassName()}
              >
                {INTERVENTION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                Duration
              </label>
              <input
                type="text"
                value={project.duration}
                onChange={(e) => patchProject({ duration: e.target.value })}
                className={fieldClassName()}
              />
            </div>
            <div className="md:col-span-2">
              <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                Contact Person
              </label>
              <input
                type="text"
                value={project.contactPerson}
                onChange={(e) => patchProject({ contactPerson: e.target.value })}
                className={fieldClassName()}
              />
            </div>
            <div>
              <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                Target Beneficiaries
                {!typeConfig.requireBeneficiaryTarget && (
                  <span className={cn("ml-1 font-normal normal-case", muted)}>(optional)</span>
                )}
              </label>
              <input
                type="number"
                min={0}
                value={project.totalBeneficiaries || ""}
                onChange={(e) =>
                  patchProject({
                    totalBeneficiaries: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className={fieldClassName()}
                placeholder="e.g. 80000"
              />
            </div>
            <div className="md:col-span-2">
              <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                Donor mapping
              </label>
              <DonorSelector
                value={project.donorIds ?? []}
                onChange={(donorIds) => patchProject({ donorIds })}
                fundingType={project.fundingType ?? "CSR"}
                isDark={isDark}
              />
            </div>
            <div className="md:col-span-2">
              <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                SDG Alignment
              </label>
              <SdgSelector
                value={project.sdgGoals ?? []}
                onChange={(sdgGoals) => patchProject({ sdgGoals })}
                isDark={isDark}
              />
            </div>
          </div>

          <div className={cn("border-t pt-5", isDark ? "border-slate-800" : "border-slate-200")}>
            <button
              type="button"
              onClick={() => setShowOptionalDetails((v) => !v)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors",
                isDark
                  ? "border-slate-700 hover:bg-slate-800"
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100"
              )}
            >
              <span>Add more details now? (About us & project summary)</span>
              <span className={cn("text-xs", muted)}>{showOptionalDetails ? "Hide" : "Optional"}</span>
            </button>
            {showOptionalDetails && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                    About your organization
                  </label>
                  <textarea
                    rows={6}
                    value={project.aboutUs}
                    onChange={(e) => patchProject({ aboutUs: e.target.value })}
                    className={fieldClassName("resize-y leading-relaxed")}
                  />
                </div>
                <div>
                  <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide", label)}>
                    Project summary
                  </label>
                  <textarea
                    rows={6}
                    value={project.executiveSummary}
                    onChange={(e) => patchProject({ executiveSummary: e.target.value })}
                    className={fieldClassName("resize-y leading-relaxed")}
                  />
                </div>
              </div>
            )}
          </div>
          </div>
        )}

        {step.id === "plan" && (
          <div className="space-y-8">
        {!typeConfig.skipActivitiesStep && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={cn("text-sm", muted)}>
                {typeConfig.maxActivities === 1
                  ? "Define the single activity for this project."
                  : "Define program activities with beneficiary targets. Activities can be split across multiple milestones after approval."}
              </p>
              {(!typeConfig.maxActivities || project.activities.length < typeConfig.maxActivities) && (
                <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={addActivity}>
                  <Plus className="h-4 w-4" />
                  Add Activity
                </Button>
              )}
            </div>

            {typeConfig.requireBeneficiaryTarget && (
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-xs tabular-nums",
                activityBeneficiaryTotal === (Number(project.totalBeneficiaries) || 0)
                  ? isDark
                    ? "bg-brand-mist/10 text-brand-teal-light"
                    : "bg-brand-mist text-brand-teal-dark"
                  : isDark
                    ? "bg-amber-500/10 text-amber-300"
                    : "bg-amber-50 text-amber-700"
              )}
            >
              Activity beneficiaries: {activityBeneficiaryTotal.toLocaleString("en-IN")} /{" "}
              {(Number(project.totalBeneficiaries) || 0).toLocaleString("en-IN")} project target
            </div>
            )}

            {project.activities.map((activity, index) => (
              <div
                key={activity.id}
                className={cn(
                  "rounded-lg border p-4",
                  isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50"
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className={cn("text-sm font-semibold", titleText)}>Activity {index + 1}</p>
                  {project.activities.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeActivity(activity.id)}
                      className="text-red-500 hover:text-red-600"
                      aria-label="Remove activity"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className={cn("mb-1 block text-xs font-medium", label)}>Activity Name</label>
                    <input
                      value={activity.name}
                      onChange={(e) => updateActivity(activity.id, { name: e.target.value })}
                      className={fieldClassName()}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={cn("mb-1 block text-xs font-medium", label)}>Description</label>
                    <textarea
                      rows={3}
                      value={activity.description}
                      onChange={(e) => updateActivity(activity.id, { description: e.target.value })}
                      className={fieldClassName("resize-y")}
                    />
                  </div>
                  <div>
                    <label className={cn("mb-1 block text-xs font-medium", label)}>Timeline</label>
                    <input
                      value={activity.timeline}
                      onChange={(e) => updateActivity(activity.id, { timeline: e.target.value })}
                      className={fieldClassName()}
                      placeholder="e.g. Month 1–6"
                    />
                  </div>
                  <div>
                    <label className={cn("mb-1 block text-xs font-medium", label)}>Expected Outcome</label>
                    <input
                      value={activity.expectedOutcome}
                      onChange={(e) => updateActivity(activity.id, { expectedOutcome: e.target.value })}
                      className={fieldClassName()}
                    />
                  </div>
                  <div>
                    <label className={cn("mb-1 block text-xs font-medium", label)}>Target Beneficiaries</label>
                    <input
                      type="number"
                      min={0}
                      value={activity.targetBeneficiaries || ""}
                      onChange={(e) =>
                        updateActivity(activity.id, {
                          targetBeneficiaries: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className={fieldClassName()}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={cn("mb-1 block text-xs font-medium", label)}>
                      Milestone Stage (links in next phase)
                    </label>
                    <input
                      value={activity.milestoneStage}
                      onChange={(e) => updateActivity(activity.id, { milestoneStage: e.target.value })}
                      className={fieldClassName()}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

          <div className={cn("space-y-6", !typeConfig.skipActivitiesStep && "border-t pt-8", isDark ? "border-slate-800" : "border-slate-200")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={cn("text-sm", muted)}>
                Add budget <strong className={titleText}>heads</strong> (e.g. HR Cost, Program Cost) and{" "}
                <strong className={titleText}>subheads</strong> under each. Line total = Qty × Duration × Rate.
                Admin overhead applies to eligible subheads only · eligible subtotal ₹{formatINR(adminEligibleSubtotal)}.
              </p>
              <Button type="button" variant="secondary" size="sm" className="gap-1.5 shrink-0" onClick={addBudgetHead}>
                <Plus className="h-4 w-4" />
                Add Head
              </Button>
            </div>
            {project.budget.map((category, headIndex) => (
              <div
                key={category.id}
                className={cn(
                  "overflow-hidden rounded-lg border",
                  isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50"
                )}
              >
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3",
                    isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-100"
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className={cn("shrink-0 text-xs font-semibold uppercase", label)}>Head {headIndex + 1}</span>
                    <input
                      value={category.title}
                      onChange={(e) => updateBudgetHead(category.id, e.target.value)}
                      placeholder="e.g. HR Cost, Program Cost"
                      className={fieldClassName("min-w-[12rem] flex-1 font-semibold")}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-medium tabular-nums", muted)}>
                      Subtotal: ₹{formatINR(categorySubtotal(category.id))}
                    </span>
                    {project.budget.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBudgetHead(category.id)}
                        className="rounded p-1 text-red-500 hover:bg-red-500/10"
                        aria-label="Remove budget head"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-sm">
                    <thead>
                      <tr className={cn("border-b text-left text-xs uppercase tracking-wide", border, muted)}>
                        <th className="px-4 py-2.5 font-medium">Subhead</th>
                        <th className="px-4 py-2.5 font-medium">Qty</th>
                        <th className="px-4 py-2.5 font-medium">Duration</th>
                        <th className="px-4 py-2.5 font-medium">Rate (₹)</th>
                        <th className="px-4 py-2.5 font-medium">Total (₹)</th>
                        <th className="px-4 py-2.5 text-center font-medium">Exclude Admin</th>
                        <th className="w-10 px-2 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {category.items.map((item) => (
                        <tr key={item.id} className={cn("border-b last:border-0", border)}>
                          <td className="px-4 py-3">
                            <input
                              value={item.label}
                              onChange={(e) =>
                                updateBudgetItem(category.id, item.id, { label: e.target.value })
                              }
                              placeholder="Subhead name"
                              className={fieldClassName(isDark ? "bg-transparent" : "bg-white")}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={item.quantity || ""}
                              onChange={(e) =>
                                updateBudgetItem(category.id, item.id, {
                                  quantity: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              placeholder="0"
                              className={fieldClassName("max-w-[80px] tabular-nums")}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={item.duration || ""}
                              onChange={(e) =>
                                updateBudgetItem(category.id, item.id, {
                                  duration: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              placeholder="0"
                              className={fieldClassName("max-w-[80px] tabular-nums")}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={item.amount}
                              onChange={(e) =>
                                updateBudgetItem(category.id, item.id, {
                                  amount: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className={fieldClassName("max-w-[140px] tabular-nums")}
                            />
                          </td>
                          <td className={cn("px-4 py-3 tabular-nums font-medium", titleText)}>
                            {formatINR(computeBudgetLineTotal(item))}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center">
                              <ExcludeAdminToggle
                                checked={item.excludeAdminCost}
                                isDark={isDark}
                                onChange={(checked) =>
                                  updateBudgetItem(category.id, item.id, {
                                    excludeAdminCost: checked,
                                  })
                                }
                              />
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            {category.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeBudgetSubhead(category.id, item.id)}
                                className="rounded p-1 text-red-500 hover:bg-red-500/10"
                                aria-label="Remove subhead"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={cn("border-t px-4 py-2", border)}>
                  <button
                    type="button"
                    onClick={() => addBudgetSubhead(category.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-medium text-brand-teal hover:text-brand-teal-dark dark:text-brand-teal-light"
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Subhead
                  </button>
                </div>
              </div>
            ))}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className={cn("rounded-lg border p-4", isDark ? "border-slate-700" : "border-slate-200")}>
                <p className={cn("text-xs uppercase", muted)}>Direct Subtotal</p>
                <p className={cn("mt-1 text-xl font-bold tabular-nums", titleText)}>
                  ₹{formatINR(directSubtotal)}
                </p>
              </div>
              <div className={cn("rounded-lg border p-4", isDark ? "border-slate-700" : "border-slate-200")}>
                <label className={cn("text-xs uppercase", muted)}>Admin Overhead</label>
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <div className="min-w-[5rem]">
                    <span className={cn("mb-1 block text-[10px]", muted)}>% rate</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={project.adminOverheadPercent ?? DEFAULT_ADMIN_OVERHEAD_PERCENT}
                      onChange={(e) => updateAdminPercent(Number(e.target.value) || 0)}
                      className={fieldClassName("max-w-[5rem] tabular-nums py-1.5")}
                    />
                  </div>
                  <div className="min-w-[7rem] flex-1">
                    <span className={cn("mb-1 block text-[10px]", muted)}>Amount (₹)</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={adminOverhead}
                      onChange={(e) => updateAdminAmount(Number(e.target.value) || 0)}
                      className={fieldClassName("tabular-nums py-1.5")}
                    />
                  </div>
                </div>
                <p className={cn("mt-2 text-[10px]", muted)}>
                  Default {ADMIN_OVERHEAD_RATE * 100}% of eligible lines · edit either field
                </p>
              </div>
              <div className="rounded-lg border border-brand-teal/30 bg-brand-mist/5 p-4">
                <p className="text-xs uppercase text-brand-teal">Total Evaluation</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-brand-teal-dark">
                  ₹{formatINR(totalEvaluation)}
                </p>
              </div>
            </div>
          </div>
          </div>
        )}

        {step.id === "review" && (
          <div className="space-y-6">
            <p className={cn("text-sm", muted)}>
              {isApprovedEdit
                ? "Review changes and save. The project stays approved after saving."
                : "Review your proposal summary. Click Submit to add it to the project list for approval."}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <ReviewBlock label="Title" value={project.title} isDark={isDark} />
              <ReviewBlock
                label="Project Type"
                value={formatProjectType(project.projectType)}
                isDark={isDark}
              />
              <ReviewBlock label="Applicant" value={project.applicantName} isDark={isDark} />
              <ReviewBlock label="Location" value={project.location} isDark={isDark} />
              <ReviewBlock label="Duration" value={project.duration} isDark={isDark} />
              <ReviewBlock
                label="Funding Type"
                value={formatProjectFundingType(project.fundingType)}
                isDark={isDark}
              />
              <ReviewBlock label="State" value={project.state || "—"} isDark={isDark} />
              <ReviewBlock label="District" value={project.district || "—"} isDark={isDark} />
              <ReviewBlock
                label="Geographic scope"
                value={formatProjectLocationScope(project.locationScope)}
                isDark={isDark}
              />
              {(project.locationScope ?? "single") !== "single" && (
                <ReviewBlock
                  label={project.locationScope === "multi_state" ? "States covered" : "Districts covered"}
                  value={project.coverageAreas || "—"}
                  isDark={isDark}
                  className="md:col-span-2"
                />
              )}
              <ReviewBlock
                label="Donors"
                value={resolveDonorLabels(project.donorIds ?? [], loadDonors())}
                isDark={isDark}
                className="md:col-span-2"
              />
              {!typeConfig.skipActivitiesStep && (
                <ReviewBlock label="Activities" value={`${project.activities.length} defined`} isDark={isDark} />
              )}
              <ReviewBlock
                label="Target Beneficiaries"
                value={project.totalBeneficiaries.toLocaleString("en-IN")}
                isDark={isDark}
              />
              <ReviewBlock label="Total Budget" value={`₹${formatINR(totalEvaluation)}`} isDark={isDark} />
              <ReviewBlock
                label="SDG Goals"
                value={formatSdgList(project.sdgGoals ?? [])}
                isDark={isDark}
                className="md:col-span-2"
              />
            </div>
            <div
              className={cn(
                "rounded-lg border p-4",
                isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-slate-50"
              )}
            >
              <p className={cn("mb-3 text-xs font-semibold uppercase", label)}>Export & Share</p>
              <p className={cn("mb-3 text-sm", muted)}>
                Download this proposal as a tabular Word document or PDF, or share a link before or after
                submission.
              </p>
              <ProposalExportActions
                project={{ ...project, totalEvaluation }}
                shareUrl={
                  typeof window !== "undefined"
                    ? `${window.location.origin}${basePath}/${project.id}`
                    : `${basePath}/${project.id}`
                }
              />
            </div>
            {!typeConfig.skipActivitiesStep && project.activities.length > 0 && (
            <div>
              <p className={cn("mb-2 text-xs font-medium uppercase", label)}>Activities → Milestones</p>
              <ul className={cn("space-y-2 text-sm", muted)}>
                {project.activities.map((a) => (
                  <li
                    key={a.id}
                    className={cn("rounded-lg border px-3 py-2", isDark ? "border-slate-800" : "border-slate-200")}
                  >
                    <span className={cn("font-medium", titleText)}>{a.name}</span>
                    <span className="mx-2">→</span>
                    <span>{a.milestoneStage}</span>
                  </li>
                ))}
              </ul>
            </div>
            )}
            <div
              className={cn(
                "rounded-lg border p-4 md:col-span-2",
                isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-slate-50"
              )}
            >
              <p className={cn("mb-2 text-xs font-semibold uppercase", label)}>Post-approval setup</p>
              <p className={cn("text-sm", muted)}>{typeConfig.setupFlowHint}</p>
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
                if (saveDraft(project)) {
                  router.push(isApprovedEdit ? `${basePath}/${project.id}` : basePath);
                }
              }}
            >
              {isApprovedEdit ? "Save & Exit" : "Save Draft & Exit"}
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
              <Button type="button" variant="primary" size="md" onClick={submitProposal}>
                {isApprovedEdit ? "Save Changes" : "Submit Proposal"}
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ReviewBlock({
  label,
  value,
  isDark,
  className,
}: {
  label: string;
  value: string;
  isDark: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        isDark ? "border-slate-800" : "border-slate-200",
        className
      )}
    >
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className={cn("mt-1 text-sm font-medium", isDark ? "text-white" : "text-slate-900")}>{value}</p>
    </div>
  );
}
