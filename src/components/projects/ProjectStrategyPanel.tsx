"use client";

import { useState } from "react";
import { AlertTriangle, Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { downloadIatiXml } from "@/lib/iatiExport";
import { ProjectProposal, upsertProject } from "@/lib/projects";

interface ProjectStrategyPanelProps {
  project: ProjectProposal;
  onUpdate: (p: ProjectProposal) => void;
}

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export function ProjectStrategyPanel({ project, onUpdate }: ProjectStrategyPanelProps) {
  const [orgName, setOrgName] = useState("SVITECH Foundation");
  const toc = project.theoryOfChange ?? {
    impact: "",
    outcomes: [""],
    outputs: [""],
    activities: [""],
    assumptions: [""],
  };

  function save(next: Partial<ProjectProposal>) {
    const updated = { ...project, ...next, updatedAt: new Date().toISOString() };
    upsertProject(updated);
    onUpdate(updated);
  }

  function updateToc(field: keyof typeof toc, value: string | string[]) {
    save({ theoryOfChange: { ...toc, [field]: value } });
  }

  function addRisk() {
    const risks = project.risks ?? [];
    save({
      risks: [
        ...risks,
        {
          id: crypto.randomUUID(),
          title: "",
          likelihood: "MEDIUM" as RiskLevel,
          impact: "MEDIUM" as RiskLevel,
          mitigation: "",
        },
      ],
    });
  }

  async function exportIati() {
    try {
      const res = await fetch("/api/org-settings");
      if (res.ok) {
        const data = await res.json();
        setOrgName(data.settings?.orgName ?? orgName);
        downloadIatiXml(project, data.settings?.orgName ?? orgName);
      } else {
        downloadIatiXml(project, orgName);
      }
    } catch {
      downloadIatiXml(project, orgName);
    }
  }

  return (
    <Card className="mt-6">
      <CardTitle>Strategy, risks & transparency</CardTitle>
      <CardDescription className="mb-4">
        Theory of Change, risk register, and IATI export — optional layers on top of your approved project.
      </CardDescription>

      <div className="space-y-6">
        <section>
          <h3 className="text-sm font-semibold text-slate-900">Theory of Change</h3>
          <div className="mt-3 space-y-3">
            <div>
              <Label>Long-term impact</Label>
              <Input
                value={toc.impact}
                onChange={(e) => updateToc("impact", e.target.value)}
                placeholder="What change do we want to see in 5–10 years?"
              />
            </div>
            {(["outcomes", "outputs", "activities", "assumptions"] as const).map((field) => (
              <div key={field}>
                <Label className="capitalize">{field}</Label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  value={(toc[field] as string[]).join("\n")}
                  onChange={(e) =>
                    updateToc(
                      field,
                      e.target.value.split("\n").filter(Boolean)
                    )
                  }
                  placeholder={`One ${field.slice(0, -1)} per line`}
                />
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Risk register</h3>
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addRisk}>
              <Plus className="h-3.5 w-3.5" />
              Add risk
            </Button>
          </div>
          <ul className="mt-3 space-y-3">
            {(project.risks ?? []).map((risk) => (
              <li key={risk.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      value={risk.title}
                      placeholder="Risk title"
                      onChange={(e) => {
                        const risks = (project.risks ?? []).map((r) =>
                          r.id === risk.id ? { ...r, title: e.target.value } : r
                        );
                        save({ risks });
                      }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="rounded border px-2 py-1 text-sm"
                        value={risk.likelihood}
                        onChange={(e) => {
                          const risks = (project.risks ?? []).map((r) =>
                            r.id === risk.id ? { ...r, likelihood: e.target.value as RiskLevel } : r
                          );
                          save({ risks });
                        }}
                      >
                        {(["LOW", "MEDIUM", "HIGH"] as const).map((l) => (
                          <option key={l} value={l}>Likelihood: {l}</option>
                        ))}
                      </select>
                      <select
                        className="rounded border px-2 py-1 text-sm"
                        value={risk.impact}
                        onChange={(e) => {
                          const risks = (project.risks ?? []).map((r) =>
                            r.id === risk.id ? { ...r, impact: e.target.value as RiskLevel } : r
                          );
                          save({ risks });
                        }}
                      >
                        {(["LOW", "MEDIUM", "HIGH"] as const).map((l) => (
                          <option key={l} value={l}>Impact: {l}</option>
                        ))}
                      </select>
                    </div>
                    <Input
                      value={risk.mitigation}
                      placeholder="Mitigation plan"
                      onChange={(e) => {
                        const risks = (project.risks ?? []).map((r) =>
                          r.id === risk.id ? { ...r, mitigation: e.target.value } : r
                        );
                        save({ risks });
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-red-500"
                    onClick={() => save({ risks: (project.risks ?? []).filter((r) => r.id !== risk.id) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={exportIati}>
            <Download className="h-4 w-4" />
            Export IATI XML
          </Button>
        </div>
      </div>
    </Card>
  );
}
