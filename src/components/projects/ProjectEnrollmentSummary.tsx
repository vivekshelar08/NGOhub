"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectProposal } from "@/lib/projects";
import { projectSupportsBeneficiaryStatus, projectSupportsServices } from "@/lib/projectMeta";

interface ProjectEnrollmentSummaryProps {
  project: ProjectProposal;
  variant?: "light" | "dark";
}

export function ProjectEnrollmentSummary({
  project,
  variant = "light",
}: ProjectEnrollmentSummaryProps) {
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  const isDark = variant === "dark";
  const muted = isDark ? "text-slate-400" : "text-slate-600";

  useEffect(() => {
    if (!projectSupportsBeneficiaryStatus(project.projectType) && !projectSupportsServices(project.projectType)) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/beneficiaries?projectId=${encodeURIComponent(project.id)}&countOnly=1`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setEnrolledCount(data.count ?? 0);
      } catch {
        if (!cancelled) setEnrolledCount(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [project.id, project.projectType]);

  const showPortal =
    projectSupportsBeneficiaryStatus(project.projectType) ||
    projectSupportsServices(project.projectType);

  if (!showPortal || project.status !== "APPROVED") return null;

  const target = project.totalBeneficiaries || 0;
  const progress =
    enrolledCount != null && target > 0
      ? Math.min(100, Math.round((enrolledCount / target) * 100))
      : null;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-slate-50"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wide", muted)}>
            <Users className="h-4 w-4" />
            Beneficiary enrollment
          </p>
          <p className={cn("mt-2 text-2xl font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
            {enrolledCount != null ? enrolledCount.toLocaleString("en-IN") : "—"}
            {target > 0 && (
              <span className={cn("ml-2 text-sm font-normal", muted)}>
                / {target.toLocaleString("en-IN")} target
              </span>
            )}
          </p>
          {progress != null && (
            <div className="mt-2 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-brand-mist transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
        <Link
          href={`/dashboard/beneficiaries?projectId=${encodeURIComponent(project.id)}`}
          className="rounded-lg bg-brand-red px-3 py-2 text-sm font-medium text-white hover:bg-brand-red-dark"
        >
          Open Service Portal
        </Link>
      </div>
    </div>
  );
}
