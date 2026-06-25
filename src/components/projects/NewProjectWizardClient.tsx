"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { ProjectProposalWizard } from "@/components/projects/ProjectProposalWizard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  cloneProjectFromTemplate,
  createEmptyProject,
  listApprovedProjectTemplates,
  ProjectProposal,
} from "@/lib/projects";

interface NewProjectWizardClientProps {
  basePath: "/dashboard/projects" | "/admin/projects";
  variant: "light" | "dark";
}

export function NewProjectWizardClient({ basePath, variant }: NewProjectWizardClientProps) {
  const [project, setProject] = useState<ProjectProposal | null>(null);
  const [templates, setTemplates] = useState<ProjectProposal[]>([]);
  const [showTemplates, setShowTemplates] = useState(true);

  useEffect(() => {
    setTemplates(listApprovedProjectTemplates());
  }, []);

  function startBlank() {
    setProject(createEmptyProject(crypto.randomUUID()));
    setShowTemplates(false);
  }

  function startFromTemplate(source: ProjectProposal) {
    setProject(cloneProjectFromTemplate(source, crypto.randomUUID()));
    setShowTemplates(false);
  }

  if (showTemplates && !project) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900">New project proposal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Start from scratch or copy structure from a previous approved project.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" variant="teal" onClick={startBlank}>
            Start blank proposal
          </Button>
        </div>

        {templates.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-teal">
              Copy from approved project
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <Card key={t.id} className="flex flex-col justify-between p-4">
                  <div>
                    <p className="font-medium text-slate-900">{t.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t.state || t.location} · {t.activities.length} activities
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-4 gap-1.5 self-start"
                    onClick={() => startFromTemplate(t)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Use as template
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <ProjectProposalWizard
      key={project.id}
      initialProject={project}
      basePath={basePath}
      variant={variant}
    />
  );
}
