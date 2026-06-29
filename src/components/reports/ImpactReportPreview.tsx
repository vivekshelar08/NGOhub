"use client";

import type { ReactNode } from "react";
import { ImpactReportResult, ImpactReportSections } from "@/lib/aiReport";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  BookOpen,
  Lightbulb,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

interface ImpactReportPreviewProps {
  narrative: string;
  sections?: ImpactReportSections;
  className?: string;
}

const SECTION_META: Array<{
  key: keyof ImpactReportSections;
  label: string;
  icon: typeof Target;
  accent: string;
}> = [
  { key: "inputs", label: "Inputs", icon: BarChart3, accent: "border-slate-200 bg-slate-50" },
  { key: "outputs", label: "Outputs", icon: TrendingUp, accent: "border-blue-200 bg-blue-50" },
  { key: "outcomes", label: "Outcomes", icon: Target, accent: "border-emerald-200 bg-emerald-50" },
  { key: "impact", label: "Long-term Impact", icon: Users, accent: "border-violet-200 bg-violet-50" },
  { key: "lessonsLearned", label: "Lessons Learned", icon: BookOpen, accent: "border-amber-200 bg-amber-50" },
];

export function ImpactReportPreview({ narrative, sections, className }: ImpactReportPreviewProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {sections && sections.insights.length > 0 && (
        <div className="rounded-xl border border-brand-teal/30 bg-brand-mist/50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-slate-900">AI Insights</h3>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {sections.insights.map((insight, i) => (
              <li
                key={i}
                className="rounded-lg border border-white/80 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm"
              >
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sections && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SECTION_META.map(({ key, label, icon: Icon, accent }) => {
            const text = sections[key];
            if (typeof text !== "string" || !text.trim()) return null;
            return (
              <div key={key} className={cn("rounded-xl border p-4", accent)}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-600" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {label}
                  </span>
                </div>
                <p className="line-clamp-4 text-sm text-slate-700">{text}</p>
              </div>
            );
          })}
        </div>
      )}

      <article className="prose prose-slate max-w-none rounded-lg border border-slate-200 bg-white p-6 text-sm leading-relaxed">
        {renderNarrative(narrative)}
      </article>
    </div>
  );
}

function renderNarrative(narrative: string): ReactNode[] {
  return narrative.split(/\n\n+/).map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("# ")) {
      return (
        <h1 key={i} className="mb-4 text-2xl font-bold text-slate-900">
          {trimmed.replace(/^#+\s*/, "")}
        </h1>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h2 key={i} className="mb-3 mt-6 text-lg font-semibold text-brand-teal-dark">
          {trimmed.replace(/^#+\s*/, "")}
        </h2>
      );
    }
    if (trimmed.startsWith("### ")) {
      return (
        <h3 key={i} className="mb-2 mt-4 text-base font-semibold text-slate-800">
          {trimmed.replace(/^#+\s*/, "")}
        </h3>
      );
    }
    if (trimmed.startsWith("- ")) {
      return (
        <ul key={i} className="my-3 list-disc space-y-1 pl-5 text-slate-700">
          {trimmed
            .split("\n")
            .filter((l) => l.startsWith("- "))
            .map((line, j) => (
              <li key={j}>{formatInline(line.replace(/^- /, ""))}</li>
            ))}
        </ul>
      );
    }
    if (trimmed.startsWith("---")) {
      return <hr key={i} className="my-6 border-slate-200" />;
    }
    if (trimmed.startsWith("*") && trimmed.endsWith("*")) {
      return (
        <p key={i} className="text-xs italic text-slate-500">
          {trimmed.replace(/^\*|\*$/g, "")}
        </p>
      );
    }

    return (
      <p key={i} className="mb-3 text-slate-700">
        {formatInline(trimmed)}
      </p>
    );
  });
}

function formatInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export function ImpactReportProviderBadge({
  report,
}: {
  report: Pick<ImpactReportResult, "provider" | "aiModel">;
}) {
  const labels: Record<string, string> = {
    openai: `OpenAI${report.aiModel ? ` (${report.aiModel})` : ""}`,
    groq: `Groq${report.aiModel ? ` (${report.aiModel})` : ""}`,
    gemini: `Gemini${report.aiModel ? ` (${report.aiModel})` : ""}`,
    template: "Built-in template — add OPENAI_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY",
  };
  return (
    <span className="text-xs text-slate-500">
      AI engine: {labels[report.provider] ?? report.provider}
    </span>
  );
}
