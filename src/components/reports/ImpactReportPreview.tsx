"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ImpactReportPreviewProps {
  narrative: string;
  className?: string;
}

/** Lightweight markdown preview for impact reports (headings, paragraphs, lists). */
export function ImpactReportPreview({ narrative, className }: ImpactReportPreviewProps) {
  const blocks = narrative.split(/\n\n+/);

  return (
    <article
      className={cn(
        "prose prose-slate max-w-none rounded-lg border border-slate-200 bg-white p-6 text-sm leading-relaxed",
        className
      )}
    >
      {blocks.map((block, i) => {
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
      })}
    </article>
  );
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
