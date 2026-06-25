"use client";

import { cn } from "@/lib/utils";
import { ServiceDeliveryStatus } from "@/generated/prisma/enums";
import { DELIVERY_STATUS_COLORS, DELIVERY_STATUS_LABELS } from "@/lib/service-portal-utils";

export function StatusPill({
  status,
  label,
  className,
}: {
  status?: ServiceDeliveryStatus;
  label?: string;
  className?: string;
}) {
  const text =
    label ?? (status ? DELIVERY_STATUS_LABELS[status] : "Unknown");
  const colorClass =
    className ??
    (status ? DELIVERY_STATUS_COLORS[status] : "bg-slate-100 text-slate-700");

  return (
    <span
      className={cn(
        "inline-flex max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-medium",
        colorClass
      )}
      title={text}
    >
      {text}
    </span>
  );
}

export function UrgentBadge() {
  return (
    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
      Urgent
    </span>
  );
}

export function CaseStudyBadge() {
  return (
    <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
      Case Study
    </span>
  );
}

export function RemovedBadge() {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      Removed
    </span>
  );
}

export function ObjectionBadge() {
  return (
    <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-900">
      Objection
    </span>
  );
}
