"use client";

import { BeneficiaryCohort } from "@/generated/prisma/enums";
import { BENEFICIARY_COHORT_OPTIONS } from "@/lib/service-portal-utils";
import { cn } from "@/lib/utils";

interface CohortMultiSelectProps {
  value: BeneficiaryCohort[];
  onChange: (cohorts: BeneficiaryCohort[]) => void;
  className?: string;
  disabled?: boolean;
}

export function CohortMultiSelect({
  value,
  onChange,
  className,
  disabled,
}: CohortMultiSelectProps) {
  function toggle(cohort: BeneficiaryCohort) {
    if (disabled) return;
    if (value.includes(cohort)) {
      onChange(value.filter((c) => c !== cohort));
    } else {
      onChange([...value, cohort]);
    }
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {BENEFICIARY_COHORT_OPTIONS.map(({ value: cohort, label }) => {
        const selected = value.includes(cohort);
        return (
          <button
            key={cohort}
            type="button"
            disabled={disabled}
            onClick={() => toggle(cohort)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px]",
              selected
                ? "border-brand-teal bg-brand-mist text-brand-teal-dark"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
