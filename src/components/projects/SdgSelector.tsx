"use client";

import { cn } from "@/lib/utils";
import { SDG_GOALS } from "@/lib/sdg";

interface SdgSelectorProps {
  value: number[];
  onChange: (ids: number[]) => void;
  isDark?: boolean;
}

export function SdgSelector({ value, onChange, isDark = false }: SdgSelectorProps) {
  const selected = new Set(value);
  const label = isDark ? "text-slate-500" : "text-slate-600";
  const border = isDark ? "border-slate-800" : "border-slate-200";

  function toggle(id: number) {
    const next = selected.has(id) ? value.filter((v) => v !== id) : [...value, id].sort((a, b) => a - b);
    onChange(next);
  }

  return (
    <div>
      <p className={cn("mb-3 text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
        Select all UN Sustainable Development Goals this intervention supports. Used for individual and
        combined annual SDG reporting.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SDG_GOALS.map((goal) => {
          const checked = selected.has(goal.id);
          return (
            <label
              key={goal.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                border,
                checked
                  ? isDark
                    ? "border-brand-teal/50 bg-brand-mist/10"
                    : "border-brand-teal bg-brand-mist"
                  : isDark
                    ? "hover:bg-slate-800/50"
                    : "hover:bg-slate-50"
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(goal.id)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
              />
              <span>
                <span className={cn("font-semibold tabular-nums", isDark ? "text-brand-teal-light" : "text-brand-teal-dark")}>
                  SDG {goal.id}
                </span>
                <span className={cn("mt-0.5 block text-xs leading-snug", label)}>{goal.title}</span>
              </span>
            </label>
          );
        })}
      </div>
      {value.length > 0 && (
        <p className={cn("mt-3 text-xs", label)}>
          {value.length} goal{value.length === 1 ? "" : "s"} selected
        </p>
      )}
    </div>
  );
}
