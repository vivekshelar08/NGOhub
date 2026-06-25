"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const HELP_TEXTS = {
  follow_up:
    "Schedule and complete beneficiary follow-ups before the recheck due date. Overdue follow-ups appear in notifications.",
  budget_head:
    "Tag expenses with the matching budget head so utilization reports align with your project proposal.",
  compliance:
    "Track statutory filings (FCRA, 80G, audit, ITR). Upload proof to the document vault and mark items filed when done.",
  me_rag:
    "Monitoring & evaluation RAG status compares KPI targets to actuals. Green = on track, amber = at risk, red = behind.",
  offline_sync:
    "Actions saved while offline are queued locally. Sync when back online to push them to the server.",
  field_evidence:
    "Attach photos or documents as field evidence for activities, expenses, or compliance proof.",
} as const;

export type HelpTextKey = keyof typeof HELP_TEXTS;

interface HelpTipProps {
  content?: string;
  className?: string;
  /** Optional preset key — uses HELP_TEXTS when provided */
  helpKey?: HelpTextKey;
}

export function HelpTip({ content, className, helpKey }: HelpTipProps) {
  const text = helpKey ? HELP_TEXTS[helpKey] : (content ?? "");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label="Help"
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 shadow-lg sm:w-64"
        >
          {text}
          <span className="absolute left-1/2 top-full -mt-px -translate-x-1/2 border-4 border-transparent border-t-white" />
        </div>
      )}
    </div>
  );
}
