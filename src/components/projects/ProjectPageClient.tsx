"use client";

import { useEffect, useState } from "react";
import { ProjectDetailView } from "@/components/projects/ProjectDetailView";
import { ProjectProposalWizard } from "@/components/projects/ProjectProposalWizard";
import {
  canAccessProposalEditPage,
  getProjectById,
  isEditableStatus,
  ProjectProposal,
} from "@/lib/projects";

interface ProjectPageClientProps {
  projectId: string;
  mode: "view" | "edit" | "auto";
  basePath: "/dashboard/projects" | "/admin/projects";
  variant: "light" | "dark";
  canReview?: boolean;
  initialProject?: ProjectProposal;
}

export function ProjectPageClient({
  projectId,
  mode,
  basePath,
  variant,
  canReview,
  initialProject,
}: ProjectPageClientProps) {
  const [project, setProject] = useState<ProjectProposal | null>(
    initialProject ?? null
  );
  const [ready, setReady] = useState(Boolean(initialProject));

  useEffect(() => {
    if (initialProject) {
      setProject(initialProject);
      setReady(true);
      return;
    }
    const loaded = getProjectById(projectId);
    setProject(loaded ?? null);
    setReady(true);
  }, [projectId, initialProject]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center p-8 text-sm text-slate-500">
        Project not found.
      </div>
    );
  }

  const useWizard =
    mode === "edit"
      ? canAccessProposalEditPage(project)
      : mode === "auto" && isEditableStatus(project.status);

  if (mode === "edit" && !canAccessProposalEditPage(project)) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center p-8 text-center text-sm text-slate-500">
        <p>This proposal cannot be edited.</p>
        <p className="mt-2 max-w-md">
          Approved proposals can only be edited twice from the project detail or list actions menu.
        </p>
        <a href={`${basePath}/${project.id}`} className="mt-4 text-brand-teal hover:underline">
          Back to project
        </a>
      </div>
    );
  }

  if (useWizard) {
    return (
      <ProjectProposalWizard
        key={project.id}
        initialProject={project}
        basePath={basePath}
        variant={variant}
      />
    );
  }

  return (
    <ProjectDetailView
      projectId={projectId}
      basePath={basePath}
      variant={variant}
      canReview={canReview}
    />
  );
}
