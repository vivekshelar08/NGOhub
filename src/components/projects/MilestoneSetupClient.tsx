"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MilestoneSetupWizard } from "@/components/projects/MilestoneSetupWizard";
import { getProjectById, needsMilestoneSetup, ProjectProposal } from "@/lib/projects";

interface AssignableUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface MilestoneSetupClientProps {
  projectId: string;
  basePath: "/dashboard/projects" | "/admin/projects";
  variant: "light" | "dark";
  assignableUsers: AssignableUser[];
}

export function MilestoneSetupClient({
  projectId,
  basePath,
  variant,
  assignableUsers,
}: MilestoneSetupClientProps) {
  const [project, setProject] = useState<ProjectProposal | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProject(getProjectById(projectId) ?? null);
    setReady(true);
  }, [projectId]);

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
        <Link href={basePath} className="mt-4 text-brand-teal hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  if (project.status !== "APPROVED") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center p-8 text-sm text-slate-500">
        Milestone setup is only available for approved proposals.
        <Link href={`${basePath}/${project.id}`} className="mt-4 text-brand-teal hover:underline">
          View project
        </Link>
      </div>
    );
  }

  if (!needsMilestoneSetup(project)) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center p-8 text-sm text-slate-500">
        {project.setup?.completedAt
          ? "This project is already configured."
          : "This project type does not require milestone setup."}
        <Link href={`${basePath}/${project.id}`} className="mt-4 text-brand-teal hover:underline">
          View project
        </Link>
      </div>
    );
  }

  return (
    <MilestoneSetupWizard
      key={project.id}
      project={project}
      basePath={basePath}
      variant={variant}
      assignableUsers={assignableUsers}
    />
  );
}
