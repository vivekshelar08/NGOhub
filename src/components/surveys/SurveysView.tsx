"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PageHeader, PageShell } from "@/components/ui/PageHeader";
import { SurveyBuilderPanel } from "@/components/surveys/SurveyBuilderPanel";
import { SurveyFillPanel } from "@/components/surveys/SurveyFillPanel";
import { SurveyResultsPanel } from "@/components/surveys/SurveyResultsPanel";

type SurveyTab = "fill" | "create" | "results";

interface SurveysViewProps {
  userName: string;
  canCreate: boolean;
  canFill: boolean;
  canViewResults: boolean;
  canExport: boolean;
}

export function SurveysView({
  canCreate,
  canFill,
  canViewResults,
  canExport,
}: SurveysViewProps) {
  const defaultTab: SurveyTab = canFill ? "fill" : canCreate ? "create" : "results";
  const [tab, setTab] = useState<SurveyTab>(defaultTab);
  const [flash, setFlash] = useState<{ msg: string; error?: boolean } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function onFlash(msg: string, isError?: boolean) {
    setFlash({ msg, error: isError });
    setTimeout(() => setFlash(null), 4000);
  }

  const tabs: Array<{ id: SurveyTab; label: string; show: boolean }> = [
    { id: "fill", label: "Fill Survey", show: canFill },
    { id: "create", label: "Create & Manage", show: canCreate },
    { id: "results", label: "Results & Analytics", show: canViewResults },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Data Collection"
        title="Surveys"
        description="Create custom questionnaires with multiple question types and collect structured responses from field staff."
      />

      {flash && (
        <div
          className={cn(
            "mb-4 rounded-lg px-4 py-3 text-sm font-medium",
            flash.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          )}
        >
          {flash.msg}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-brand-teal text-brand-teal"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === "fill" && canFill && (
        <SurveyFillPanel
          key={refreshKey}
          onSuccess={(msg) => onFlash(msg)}
          onError={(msg) => onFlash(msg, true)}
        />
      )}

      {tab === "create" && canCreate && (
        <SurveyBuilderPanel
          key={refreshKey}
          onSuccess={(msg) => onFlash(msg)}
          onError={(msg) => onFlash(msg, true)}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {tab === "results" && canViewResults && (
        <SurveyResultsPanel canExport={canExport} />
      )}
    </PageShell>
  );
}
