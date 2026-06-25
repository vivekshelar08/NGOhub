"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Pencil, RotateCcw, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProposalExportActions } from "@/components/projects/ProposalExportActions";
import { ProjectEnrollmentSummary } from "@/components/projects/ProjectEnrollmentSummary";
import { ProjectEnhancementsPanel } from "@/components/projects/ProjectEnhancementsPanel";
import { ProjectStrategyPanel } from "@/components/projects/ProjectStrategyPanel";
import { cn } from "@/lib/utils";
import { formatSdgLabel } from "@/lib/sdg";
import { loadDonors, resolveDonorLabels } from "@/lib/donors";
import { formatProjectFundingType, formatProjectLocationScope, formatProjectType, getCatalogStepLabel, projectSupportsBeneficiaryStatus } from "@/lib/projectMeta";
import {
  computeBudgetLineTotal,
  computeMilestoneBudgetAmount,
  computeBudgetTotals,
  budgetAdminInputFromProject,
  canEditApprovedProposal,
  deleteProject,
  formatINR,
  getProjectById,
  getProposalEditCount,
  isEditableStatus,
  isSetupComplete,
  MAX_PROPOSAL_EDITS_AFTER_APPROVAL,
  needsMilestoneSetup,
  ProjectProposal,
  ProposalStatus,
  startApprovedProposalEdit,
  STATUS_STYLES,
  upsertProject,
} from "@/lib/projects";

interface ProjectDetailViewProps {
  projectId: string;
  basePath: "/dashboard/projects" | "/admin/projects";
  variant?: "light" | "dark";
  canReview?: boolean;
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  const styles = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1",
        styles.badge
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", styles.dot)} />
      {status}
    </span>
  );
}

export function ProjectDetailView({
  projectId,
  basePath,
  variant = "light",
  canReview = false,
}: ProjectDetailViewProps) {
  const router = useRouter();
  const isDark = variant === "dark";
  const [project, setProject] = useState<ProjectProposal | null>(null);
  const [donors, setDonors] = useState<ReturnType<typeof loadDonors>>([]);

  useEffect(() => {
    setProject(getProjectById(projectId) ?? null);
    setDonors(loadDonors());
  }, [projectId]);

  const isDarkTheme = isDark;
  const panel = isDarkTheme ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white shadow-sm";
  const titleText = isDarkTheme ? "text-white" : "text-slate-900";
  const muted = isDarkTheme ? "text-slate-400" : "text-slate-500";
  const border = isDarkTheme ? "border-slate-800" : "border-slate-200";

  function updateStatus(status: ProposalStatus) {
    if (!project) return;
    const saved = upsertProject({ ...project, status });
    setProject(saved);
    if (status === "REVISED") {
      router.push(`${basePath}/${project.id}/edit`);
    } else if (status === "APPROVED") {
      const approved = { ...saved, status: "APPROVED" as const };
      if (needsMilestoneSetup(approved)) {
        router.push(`${basePath}/${project.id}/setup`);
      } else {
        router.push(`${basePath}/${project.id}`);
      }
    } else {
      router.push(basePath);
    }
  }

  function handleDelete() {
    if (!project) return;
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    deleteProject(project.id);
    router.push(basePath);
  }

  if (!project) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center p-8">
        <p className={cn("text-sm", muted)}>Project not found.</p>
        <Link href={basePath} className="mt-4 text-sm text-brand-teal hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const { totalEvaluation, adminOverhead, adminOverheadPercent } = computeBudgetTotals(
    project.budget,
    budgetAdminInputFromProject(project)
  );
  const showReviewActions = canReview && project.status === "SUBMITTED";
  const showEdit = isEditableStatus(project.status);
  const showApprovedEdit = canEditApprovedProposal(project);
  const showSetup = canReview && needsMilestoneSetup(project);
  const setupDone = isSetupComplete(project);
  const currentProject = project;

  function handleEditApproved() {
    if (!canEditApprovedProposal(currentProject)) return;
    const remaining = MAX_PROPOSAL_EDITS_AFTER_APPROVAL - getProposalEditCount(currentProject);
    if (
      !window.confirm(
        `Edit approved proposal "${currentProject.title}"? You have ${remaining} edit${remaining === 1 ? "" : "s"} remaining.`
      )
    ) {
      return;
    }
    const updated = startApprovedProposalEdit(currentProject);
    if (!updated) return;
    router.push(`${basePath}/${currentProject.id}/edit`);
  }

  return (
    <div className="p-6 md:p-8">
      <Link
        href={basePath}
        className={cn(
          "mb-4 inline-flex items-center gap-1.5 text-sm transition-colors",
          isDarkTheme ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all projects
      </Link>

      <section className={cn("mb-6 rounded-xl border p-5 md:p-6", panel)}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <StatusBadge status={project.status} />
            <h1 className={cn("mt-3 text-2xl font-bold", titleText)}>{project.title}</h1>
            <p className={cn("mt-1 text-sm", muted)}>
              {project.applicantName} · {project.location} · {project.duration}
            </p>
            <p className={cn("mt-1 text-xs", muted)}>
              {formatProjectType(project.projectType)}
              {" · "}
              {formatProjectFundingType(project.fundingType)}
              {project.state ? ` · ${project.state}` : ""}
              {project.district ? ` · ${project.district}` : ""}
              {project.locationScope && project.locationScope !== "single"
                ? ` · ${formatProjectLocationScope(project.locationScope)}`
                : ""}
              {(project.donorIds ?? []).length > 0 &&
                ` · ${resolveDonorLabels(project.donorIds ?? [], donors)}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {showEdit && (
              <Link
                href={`${basePath}/${project.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <Pencil className="h-4 w-4" />
                Continue Editing
              </Link>
            )}

            {showApprovedEdit && (
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={handleEditApproved}
              >
                <Pencil className="h-4 w-4" />
                Edit Proposal ({getProposalEditCount(project)}/{MAX_PROPOSAL_EDITS_AFTER_APPROVAL})
              </Button>
            )}

            {showSetup && (
              <Link
                href={`${basePath}/${project.id}/setup`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
              >
                Configure Milestones
              </Link>
            )}

            {setupDone && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-teal/30 bg-brand-mist/10 px-3 py-1.5 text-sm font-medium text-brand-teal-dark dark:text-brand-teal-light">
                <CheckCircle className="h-4 w-4" />
                Active
              </span>
            )}

            {showReviewActions && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => updateStatus("APPROVED")}
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 border border-violet-500/30 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-200"
                  onClick={() => updateStatus("REVISED")}
                >
                  <RotateCcw className="h-4 w-4" />
                  Revise
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => updateStatus("REJECTED")}
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              </>
            )}

            {(canReview || project.status === "DRAFT") && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-red-600 hover:bg-red-50" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {project.status !== "DRAFT" && (
          <div className={cn("mt-4 rounded-lg border p-4", border, isDarkTheme ? "bg-slate-950/40" : "bg-slate-50")}>
            <p className={cn("mb-2 text-xs font-semibold uppercase", muted)}>Export & Share</p>
            <ProposalExportActions
              project={project}
              shareUrl={
                typeof window !== "undefined"
                  ? window.location.href
                  : `${basePath}/${project.id}`
              }
            />
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Funding & Donors" isDark={isDarkTheme}>
          <dl className={cn("grid gap-3 text-sm sm:grid-cols-2", muted)}>
            <div>
              <dt className="text-xs uppercase">Funding type</dt>
              <dd className={cn("mt-1 font-medium", titleText)}>
                {formatProjectFundingType(project.fundingType)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase">State</dt>
              <dd className={cn("mt-1 font-medium", titleText)}>{project.state || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase">District</dt>
              <dd className={cn("mt-1 font-medium", titleText)}>{project.district || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase">Geographic scope</dt>
              <dd className={cn("mt-1 font-medium", titleText)}>
                {formatProjectLocationScope(project.locationScope)}
              </dd>
            </div>
            {(project.locationScope ?? "single") !== "single" && (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase">
                  {project.locationScope === "multi_state" ? "States covered" : "Districts covered"}
                </dt>
                <dd className={cn("mt-1 whitespace-pre-wrap", titleText)}>
                  {project.coverageAreas || "—"}
                </dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase">Donors</dt>
              <dd className={cn("mt-1", titleText)}>
                {(project.donorIds ?? []).length > 0
                  ? resolveDonorLabels(project.donorIds ?? [], donors)
                  : "—"}
              </dd>
            </div>
          </dl>
        </Section>

        <Section title="SDG Alignment" isDark={isDarkTheme}>
          {(project.sdgGoals ?? []).length > 0 ? (
            <ul className={cn("space-y-2 text-sm", muted)}>
              {[...project.sdgGoals]
                .sort((a, b) => a - b)
                .map((id) => (
                  <li
                    key={id}
                    className={cn(
                      "rounded-lg border px-3 py-2",
                      border,
                      isDarkTheme ? "bg-slate-950/40" : "bg-slate-50"
                    )}
                  >
                    <span className={cn("font-medium", titleText)}>{formatSdgLabel(id)}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className={cn("text-sm", muted)}>No SDG goals tagged on this proposal.</p>
          )}
        </Section>

        <Section title="Executive Summary" isDark={isDarkTheme}>
          <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", muted)}>
            {project.executiveSummary}
          </p>
        </Section>

        <Section title="About Us" isDark={isDarkTheme}>
          <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", muted)}>{project.aboutUs}</p>
        </Section>

        <Section title="Milestones & KPIs" isDark={isDarkTheme} className="lg:col-span-2">
          <div className="mb-4">
            <ProjectEnrollmentSummary project={project} variant={variant} />
          </div>
          {projectSupportsBeneficiaryStatus(project.projectType) && project.status === "APPROVED" && (
            <p className={cn("mb-4 rounded-lg border border-brand-teal/30 bg-brand-mist/5 px-4 py-3 text-sm", muted)}>
              Track beneficiary enrollment and status updates in the{" "}
              <Link
                href={`/dashboard/beneficiaries?projectId=${encodeURIComponent(project.id)}`}
                className="font-medium text-brand-teal hover:underline"
              >
                Service Portal
              </Link>
              . Use status: Data Entered → In Progress → Completed.
            </p>
          )}
          {setupDone && project.setup ? (
            <div className="space-y-4">
              {project.setup.catalog?.length > 0 && (
                <div className={cn("rounded-lg border p-4", border, isDarkTheme ? "bg-slate-950/40" : "bg-slate-50")}>
                  <p className={cn("mb-2 text-xs font-semibold uppercase", muted)}>
                    {getCatalogStepLabel(project.projectType)}
                  </p>
                  <ul className={cn("space-y-1 text-sm", muted)}>
                    {project.setup.catalog.map((c) => (
                      <li key={c.id} className="flex justify-between gap-4">
                        <span className={titleText}>{c.name}</span>
                        <span className="tabular-nums text-xs">
                          {c.totalActivityCount > 0 && `${c.totalActivityCount} units`}
                          {c.totalActivityCount > 0 && c.totalBeneficiaries > 0 && " · "}
                          {c.totalBeneficiaries > 0 &&
                            `${c.totalBeneficiaries.toLocaleString("en-IN")} ben`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {project.setup.milestones.map((milestone, index) => (
                <div
                  key={milestone.id}
                  className={cn("rounded-lg border p-4", border, isDarkTheme ? "bg-slate-950/40" : "bg-slate-50")}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className={cn("font-semibold", titleText)}>
                      {index + 1}. {milestone.name}
                      <span className={cn("ml-2 text-xs font-normal", muted)}>
                      ({milestone.kpis.filter((k) => k.trackingMode === "activities" || k.trackingMode === "combined").length}{" "}
                        activity ·{" "}
                        {milestone.kpis.filter((k) => k.trackingMode === "beneficiaries").length} beneficiary KPIs
                        {milestone.beneficiaryMode === "milestone_total" ? " · milestone total ben" : ""})
                      </span>
                    </p>
                    <span className={cn("text-xs tabular-nums", muted)}>
                      {milestone.budgetPercent}% · ₹
                      {formatINR(computeMilestoneBudgetAmount(totalEvaluation, milestone.budgetPercent))}
                    </span>
                  </div>
                  <ul className={cn("mt-3 space-y-2 text-sm", muted)}>
                    {milestone.kpis.map((kpi) => (
                      <li key={kpi.id} className="flex justify-between gap-4">
                        <span>
                          {kpi.name}
                          {(kpi.catalogItemId ?? kpi.sourceActivityId) && (
                            <span className="ml-1 text-xs text-brand-teal dark:text-brand-teal-light">↗ catalog</span>
                          )}
                        </span>
                        <span className="tabular-nums">
                          {kpi.trackingMode === "beneficiaries"
                            ? `${kpi.beneficiaryCount.toLocaleString("en-IN")} beneficiaries`
                            : kpi.trackingMode === "combined"
                              ? `${kpi.activityCount ?? 0} act · ${kpi.beneficiaryCount.toLocaleString("en-IN")} ben`
                              : `${kpi.activityCount ?? 0} activities`}
                        </span>
                      </li>
                    ))}
                    {milestone.beneficiaryMode === "milestone_total" && (
                      <li className="flex justify-between gap-4 border-t border-slate-200 pt-2 font-medium dark:border-slate-700">
                        <span>Milestone beneficiary total</span>
                        <span className="tabular-nums">
                          {milestone.beneficiarySummary?.totalBeneficiaries.toLocaleString("en-IN")} beneficiaries
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          ) : project.status === "APPROVED" && needsMilestoneSetup(project) ? (
            <p className={cn("text-sm", muted)}>
              Milestone setup pending.{" "}
              {canReview && (
                <Link href={`${basePath}/${project.id}/setup`} className="text-brand-teal hover:underline">
                  Configure milestones & KPIs →
                </Link>
              )}
            </p>
          ) : project.status === "APPROVED" ? (
            <p className={cn("text-sm", muted)}>No milestone setup required for this project type.</p>
          ) : (
            <p className={cn("text-sm", muted)}>
              Activities will be organized into milestones after proposal approval.
            </p>
          )}
        </Section>

        <Section title="Activities (Proposal)" isDark={isDarkTheme} className="lg:col-span-2">
          <div className="space-y-3">
            {project.activities.map((activity) => (
              <div
                key={activity.id}
                className={cn("rounded-lg border p-4", border, isDarkTheme ? "bg-slate-950/40" : "bg-slate-50")}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className={cn("font-semibold", titleText)}>{activity.name}</p>
                  <span className="rounded-full bg-brand-mist/10 px-2 py-0.5 text-xs text-brand-teal dark:text-brand-teal-light">
                    {activity.milestoneStage}
                  </span>
                </div>
                <p className={cn("mt-2 text-sm", muted)}>{activity.description}</p>
                <div className={cn("mt-2 flex flex-wrap gap-4 text-xs", muted)}>
                  <span>Timeline: {activity.timeline}</span>
                  <span>Outcome: {activity.expectedOutcome}</span>
                  <span>Target: {activity.targetBeneficiaries.toLocaleString("en-IN")} beneficiaries</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Budget Summary" isDark={isDarkTheme} className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={cn("border-b text-left text-xs uppercase", border, muted)}>
                <tr>
                  <th className="py-2 pr-4">Head</th>
                  <th className="py-2 pr-4">Subhead</th>
                  <th className="py-2 pr-4">Qty</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2 pr-4 text-right">Rate (₹)</th>
                  <th className="py-2 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {project.budget.flatMap((category) =>
                  category.items.map((item) => (
                    <tr key={item.id} className={cn("border-b", border)}>
                      <td className={cn("py-2 pr-4", muted)}>{category.title}</td>
                      <td className={cn("py-2 pr-4", titleText)}>{item.label}</td>
                      <td className={cn("py-2 pr-4 tabular-nums", muted)}>
                        {item.quantity > 0 ? item.quantity : "—"}
                      </td>
                      <td className={cn("py-2 pr-4 tabular-nums", muted)}>
                        {item.duration > 0 ? item.duration : "—"}
                      </td>
                      <td className={cn("py-2 pr-4 text-right tabular-nums", muted)}>
                        {formatINR(item.amount)}
                      </td>
                      <td className={cn("py-2 text-right tabular-nums font-medium", titleText)}>
                        {formatINR(computeBudgetLineTotal(item))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className={cn("mt-4 text-right text-lg font-bold text-brand-teal", isDarkTheme && "text-brand-teal-light")}>
            Admin overhead ({adminOverheadPercent}%): ₹{formatINR(adminOverhead)} · Total Evaluation: ₹
            {formatINR(totalEvaluation)} · Target beneficiaries:{" "}
            {project.totalBeneficiaries.toLocaleString("en-IN")}
          </p>
        </Section>

        {project.status === "APPROVED" && (
          <div className="lg:col-span-2 space-y-0">
            <ProjectEnhancementsPanel projectId={project.id} project={project} />
            <ProjectStrategyPanel
              project={project}
              onUpdate={(p) => setProject(p)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  isDark,
  className,
}: {
  title: string;
  children: React.ReactNode;
  isDark: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border p-5",
        isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      <h2 className={cn("mb-4 text-sm font-semibold uppercase tracking-wide", isDark ? "text-slate-300" : "text-slate-700")}>
        {title}
      </h2>
      {children}
    </section>
  );
}
