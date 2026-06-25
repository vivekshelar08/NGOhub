"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FolderKanban, MoreHorizontal, Plus, Search } from "lucide-react";
import { CombinedSdgExportActions } from "@/components/projects/CombinedSdgExportActions";
import { cn } from "@/lib/utils";
import {
  canEditApprovedProposal,
  canOpenProposalEditor,
  canReconfigureMilestones,
  deleteProject,
  formatINR,
  getMilestoneReconfigureCount,
  getProposalEditCount,
  isEditableStatus,
  loadProjects,
  MAX_MILESTONE_RECONFIGURATIONS,
  MAX_PROPOSAL_EDITS_AFTER_APPROVAL,
  needsMilestoneSetup,
  ProposalStatus,
  ProjectProposal,
  startApprovedProposalEdit,
  startMilestoneReconfigure,
  STATUS_STYLES,
  upsertProject,
} from "@/lib/projects";
import { loadDonors, resolveDonorLabels } from "@/lib/donors";
import {
  formatProjectFundingType,
  formatProjectLocationScope,
  formatProjectType,
  PROJECT_FUNDING_TYPES,
  ProjectFundingType,
} from "@/lib/projectMeta";

interface ProjectsListViewProps {
  basePath: "/dashboard/projects" | "/admin/projects";
  variant: "light" | "dark";
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canReview?: boolean;
}

interface ProjectRowActionsMenuProps {
  project: ProjectProposal;
  isDark: boolean;
  onDelete: (project: ProjectProposal) => void;
  onReconfigure?: (project: ProjectProposal) => void;
  onEditProposal?: (project: ProjectProposal) => void;
}

function ProjectRowActionsMenu({
  project,
  isDark,
  onDelete,
  onReconfigure,
  onEditProposal,
}: ProjectRowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const showReconfigure = Boolean(onReconfigure && canReconfigureMilestones(project));
  const showEditProposal = Boolean(onEditProposal && canEditApprovedProposal(project));
  const reconfigureUsed = getMilestoneReconfigureCount(project);
  const editUsed = getProposalEditCount(project);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Project actions"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
          isDark
            ? "border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            : "border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          className={cn(
            "absolute right-0 z-20 mt-1 min-w-[11rem] overflow-hidden rounded-lg border py-1 shadow-lg",
            isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
          )}
        >
          {showEditProposal && (
            <button
              type="button"
              className={cn(
                "flex w-full items-center px-3 py-2 text-left text-sm transition-colors",
                isDark ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-50"
              )}
              onClick={() => {
                setOpen(false);
                onEditProposal!(project);
              }}
            >
              Edit proposal
              <span className={cn("ml-auto pl-2 text-xs tabular-nums", isDark ? "text-slate-500" : "text-slate-400")}>
                {editUsed}/{MAX_PROPOSAL_EDITS_AFTER_APPROVAL}
              </span>
            </button>
          )}
          {showReconfigure && (
            <button
              type="button"
              className={cn(
                "flex w-full items-center px-3 py-2 text-left text-sm transition-colors",
                isDark ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-50"
              )}
              onClick={() => {
                setOpen(false);
                onReconfigure!(project);
              }}
            >
              Reconfigure milestones
              <span className={cn("ml-auto pl-2 text-xs tabular-nums", isDark ? "text-slate-500" : "text-slate-400")}>
                {reconfigureUsed}/{MAX_MILESTONE_RECONFIGURATIONS}
              </span>
            </button>
          )}
          <button
            type="button"
            className={cn(
              "flex w-full px-3 py-2 text-left text-sm transition-colors",
              isDark ? "text-red-400 hover:bg-slate-800" : "text-red-600 hover:bg-red-50"
            )}
            onClick={() => {
              setOpen(false);
              onDelete(project);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, variant }: { status: ProposalStatus; variant: "light" | "dark" }) {
  const styles = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1",
        variant === "dark" ? styles.badge : styles.table
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
      {status}
    </span>
  );
}

export function ProjectsListView({
  basePath,
  variant,
  canCreate = true,
  canEdit = false,
  canDelete = false,
  canReview = false,
}: ProjectsListViewProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectProposal[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "ALL">("ALL");
  const [fundingFilter, setFundingFilter] = useState<ProjectFundingType | "ALL">("ALL");
  const [donors, setDonors] = useState<ReturnType<typeof loadDonors>>([]);
  const isDark = variant === "dark";

  useEffect(() => {
    function refreshDonors() {
      setDonors(loadDonors());
    }
    refreshDonors();
    window.addEventListener("donors-updated", refreshDonors);
    return () => window.removeEventListener("donors-updated", refreshDonors);
  }, []);

  useEffect(() => {
    function refreshProjects() {
      setProjects(loadProjects());
    }

    refreshProjects();
    window.addEventListener("projects-updated", refreshProjects);
    window.addEventListener("focus", refreshProjects);

    return () => {
      window.removeEventListener("projects-updated", refreshProjects);
      window.removeEventListener("focus", refreshProjects);
    };
  }, [pathname]);

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      const matchesStatus = statusFilter === "ALL" || project.status === statusFilter;
      const matchesFunding =
        fundingFilter === "ALL" || (project.fundingType ?? "CSR") === fundingFilter;
      const haystack = [
        project.title,
        project.applicantName,
        project.location,
        project.contactPerson,
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = haystack.includes(query.trim().toLowerCase());
      return matchesStatus && matchesFunding && matchesQuery;
    });
  }, [projects, query, statusFilter, fundingFilter]);

  const counts = useMemo(() => {
    return projects.reduce(
      (acc, project) => {
        acc.all += 1;
        acc[project.status] += 1;
        return acc;
      },
      { all: 0, DRAFT: 0, SUBMITTED: 0, APPROVED: 0, REJECTED: 0, REVISED: 0 }
    );
  }, [projects]);

  const panel = isDark
    ? "border-slate-800 bg-slate-900/60"
    : "border-slate-200 bg-white shadow-sm";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textMuted = isDark ? "text-slate-400" : "text-slate-500";
  const inputClass = isDark
    ? "border-slate-800 bg-slate-900 text-slate-200 placeholder:text-slate-500 focus:border-brand-teal/50 focus:ring-brand-teal/30"
    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-brand-teal";
  const rowHover = isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50";
  const border = isDark ? "border-slate-800" : "border-slate-200";
  const actionBtn = "rounded px-2 py-1 text-xs font-medium transition-colors";
  const showRowActions = canCreate || canEdit || canDelete || canReview;
  const canShowEdit = canCreate || canEdit;
  const canShowDelete = canDelete || canReview;

  function projectHref(project: ProjectProposal) {
    return isEditableStatus(project.status)
      ? `${basePath}/${project.id}/edit`
      : `${basePath}/${project.id}`;
  }

  function handleReview(project: ProjectProposal, status: ProposalStatus) {
    upsertProject({ ...project, status });
    if (status === "REVISED") {
      window.location.href = `${basePath}/${project.id}/edit`;
    } else if (status === "APPROVED") {
      window.location.href = `${basePath}/${project.id}/setup`;
    }
  }

  function handleDelete(project: ProjectProposal) {
    if (!window.confirm(`Delete "${project.title}"?`)) return;
    deleteProject(project.id);
    setProjects(loadProjects());
  }

  function handleEditProposal(project: ProjectProposal) {
    if (!canEditApprovedProposal(project)) return;
    const remaining = MAX_PROPOSAL_EDITS_AFTER_APPROVAL - getProposalEditCount(project);
    if (
      !window.confirm(
        `Edit approved proposal "${project.title}"? You have ${remaining} edit${remaining === 1 ? "" : "s"} remaining.`
      )
    ) {
      return;
    }
    const updated = startApprovedProposalEdit(project);
    if (!updated) return;
    setProjects(loadProjects());
    router.push(`${basePath}/${project.id}/edit`);
  }

  function handleReconfigure(project: ProjectProposal) {
    if (!canReconfigureMilestones(project)) return;
    if (
      !window.confirm(
        `Reconfigure milestones for "${project.title}"? You have ${MAX_MILESTONE_RECONFIGURATIONS - getMilestoneReconfigureCount(project)} reconfiguration(s) remaining.`
      )
    ) {
      return;
    }
    const updated = startMilestoneReconfigure(project);
    if (!updated) return;
    setProjects(loadProjects());
    router.push(`${basePath}/${project.id}/setup`);
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={cn("text-xs font-medium uppercase tracking-widest", textMuted)}>Projects</p>
          <h1 className={cn("mt-1 text-2xl font-bold", textPrimary)}>All Projects</h1>
          <p className={cn("mt-1 text-sm", textMuted)}>
            Review intervention proposals, track workflow status, and manage evaluations.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          {canReview && projects.length > 0 && (
            <CombinedSdgExportActions projects={projects} />
          )}
          {canCreate && (
            <Link
              href={`${basePath}/new`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-red-dark"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </Link>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {(
          [
            { key: "ALL", label: "Total", value: counts.all },
            { key: "DRAFT", label: "Draft", value: counts.DRAFT },
            { key: "SUBMITTED", label: "Submitted", value: counts.SUBMITTED },
            { key: "APPROVED", label: "Approved", value: counts.APPROVED },
            { key: "REJECTED", label: "Rejected", value: counts.REJECTED },
            { key: "REVISED", label: "Revised", value: counts.REVISED },
          ] as const
        ).map((stat) => (
          <button
            key={stat.key}
            type="button"
            onClick={() => setStatusFilter(stat.key)}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors",
              panel,
              statusFilter === stat.key
                ? isDark
                  ? "border-brand-teal/40 ring-1 ring-brand-teal/20"
                  : "border-brand-teal ring-1 ring-brand-teal/30"
                : isDark
                  ? "hover:border-slate-700"
                  : "hover:border-slate-300"
            )}
          >
            <p className={cn("text-xs font-medium uppercase tracking-wide", textMuted)}>{stat.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", textPrimary)}>{stat.value}</p>
          </button>
        ))}
      </div>

      <div className={cn("mb-4 flex flex-col gap-3 sm:flex-row sm:items-center", textMuted)}>
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(
              "w-full rounded-lg border py-2 pl-10 pr-4 text-sm outline-none focus:ring-1",
              inputClass
            )}
          />
        </div>
        <p className="text-sm">
          Showing {filtered.length} of {projects.length} projects
        </p>
        <select
          value={fundingFilter}
          onChange={(e) => setFundingFilter(e.target.value as ProjectFundingType | "ALL")}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1",
            inputClass
          )}
        >
          <option value="ALL">All funding types</option>
          {PROJECT_FUNDING_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className={cn("overflow-hidden rounded-xl border", panel)}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div
              className={cn(
                "mb-4 flex h-12 w-12 items-center justify-center rounded-xl",
                isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
              )}
            >
              <FolderKanban className="h-5 w-5" />
            </div>
            <p className={cn("font-medium", textPrimary)}>No projects found</p>
            <p className={cn("mt-1 max-w-sm text-sm", textMuted)}>
              {canCreate
                ? "Create your first intervention proposal to get started."
                : "No projects match your current filters."}
            </p>
            {canCreate && (
              <Link
                href={`${basePath}/new`}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-red-dark"
              >
                <Plus className="h-4 w-4" />
                Create Project
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] text-left text-sm">
              <thead className={cn("border-b text-xs uppercase tracking-wide", border, textMuted)}>
                <tr>
                  <th className="px-4 py-3 font-medium">Intervention</th>
                  <th className="px-4 py-3 font-medium">Applicant</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Donor(s)</th>
                  <th className="px-4 py-3 font-medium">Total (₹)</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  {showRowActions && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => (
                  <tr key={project.id} className={cn("border-b last:border-0", border, rowHover)}>
                    <td className="px-4 py-3">
                      <Link
                        href={projectHref(project)}
                        className={cn(
                          "font-medium transition-colors hover:text-brand-teal",
                          isDark ? "text-slate-200 hover:text-brand-teal-light" : "text-slate-900"
                        )}
                      >
                        {project.title || "Untitled proposal"}
                      </Link>
                      <p className={cn("mt-0.5 text-xs", textMuted)}>
                        {formatProjectType(project.projectType)} · {project.interventionNature}
                      </p>
                    </td>
                    <td className={cn("px-4 py-3", textMuted)}>{project.applicantName || "—"}</td>
                    <td className={cn("px-4 py-3", textMuted)}>{project.location || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={project.status} variant={variant} />
                    </td>
                    <td className={cn("px-4 py-3 text-xs", textMuted)}>
                      {formatProjectFundingType(project.fundingType)}
                      {project.state && (
                        <span className="mt-0.5 block">
                          {project.state}
                          {project.district ? ` · ${project.district}` : ""}
                        </span>
                      )}
                      {project.locationScope && project.locationScope !== "single" && (
                        <span className="mt-0.5 block text-[11px]">
                          {formatProjectLocationScope(project.locationScope)}
                        </span>
                      )}
                    </td>
                    <td className={cn("max-w-[140px] truncate px-4 py-3 text-xs", textMuted)} title={resolveDonorLabels(project.donorIds ?? [], donors)}>
                      {resolveDonorLabels(project.donorIds ?? [], donors)}
                    </td>
                    <td className={cn("px-4 py-3 font-medium tabular-nums", textPrimary)}>
                      ₹{formatINR(project.totalEvaluation)}
                    </td>
                    <td className={cn("px-4 py-3 text-xs", textMuted)}>
                      {new Date(project.updatedAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    {showRowActions && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {canShowEdit && isEditableStatus(project.status) && (
                            <Link
                              href={`${basePath}/${project.id}/edit`}
                              className={cn(
                                actionBtn,
                                "border border-brand-red/40 bg-brand-red/10 text-brand-teal-dark hover:bg-brand-red/20 dark:text-brand-teal-light"
                              )}
                            >
                              Edit
                            </Link>
                          )}

                          {canShowEdit &&
                            !isEditableStatus(project.status) &&
                            canEditApprovedProposal(project) && (
                            <button
                              type="button"
                              className={cn(
                                actionBtn,
                                "border border-brand-red/40 bg-brand-red/10 text-brand-teal-dark hover:bg-brand-red/20 dark:text-brand-teal-light"
                              )}
                              onClick={() => handleEditProposal(project)}
                            >
                              Edit
                            </button>
                          )}

                          {canShowEdit &&
                            !isEditableStatus(project.status) &&
                            canOpenProposalEditor(project) &&
                            !canEditApprovedProposal(project) && (
                              <Link
                                href={`${basePath}/${project.id}/edit`}
                                className={cn(
                                  actionBtn,
                                  "border border-brand-red/40 bg-brand-red/10 text-brand-teal-dark hover:bg-brand-red/20 dark:text-brand-teal-light"
                                )}
                              >
                                Edit
                              </Link>
                            )}

                          {canReview && project.status === "SUBMITTED" && (
                            <>
                              <button
                                type="button"
                                className={cn(actionBtn, "bg-brand-red text-white hover:bg-brand-red-dark")}
                                onClick={() => handleReview(project, "APPROVED")}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className={cn(actionBtn, "bg-violet-600 text-white hover:bg-violet-700")}
                                onClick={() => handleReview(project, "REVISED")}
                              >
                                Revise
                              </button>
                              <button
                                type="button"
                                className={cn(actionBtn, "bg-red-600 text-white hover:bg-red-700")}
                                onClick={() => handleReview(project, "REJECTED")}
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {needsMilestoneSetup(project) && (
                            <Link
                              href={`${basePath}/${project.id}/setup`}
                              className={cn(actionBtn, "bg-violet-600 text-white hover:bg-violet-700")}
                            >
                              Setup
                            </Link>
                          )}

                          {canShowDelete && (
                            <button
                              type="button"
                              className={cn(
                                actionBtn,
                                isDark
                                  ? "border border-red-500/30 text-red-400 hover:bg-red-500/10"
                                  : "border border-red-300 text-red-600 hover:bg-red-50"
                              )}
                              onClick={() => handleDelete(project)}
                            >
                              Delete
                            </button>
                          )}

                          {(canReconfigureMilestones(project) ||
                            (canEditApprovedProposal(project) && !isEditableStatus(project.status))) && (
                            <ProjectRowActionsMenu
                              project={project}
                              isDark={isDark}
                              onDelete={handleDelete}
                              onReconfigure={canReconfigureMilestones(project) ? handleReconfigure : undefined}
                              onEditProposal={
                                canEditApprovedProposal(project) && !isEditableStatus(project.status)
                                  ? handleEditProposal
                                  : undefined
                              }
                            />
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
