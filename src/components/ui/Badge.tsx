import { cn } from "@/lib/utils";
import { Role } from "@/generated/prisma/enums";
import { formatRole } from "@/lib/utils";

const roleStyles: Record<Role, string> = {
  ADMIN: "bg-brand-red-light text-brand-red ring-1 ring-brand-red/20",
  MANAGER: "bg-brand-blue-light text-brand-blue ring-1 ring-brand-blue/20",
  ACCOUNTANT: "bg-violet-50 text-violet-800 ring-1 ring-violet-200",
  HR: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  COORDINATOR: "bg-brand-mist text-brand-teal ring-1 ring-brand-teal/25",
  STAFF: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
};

export function Badge({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        roleStyles[role],
        className
      )}
    >
      {formatRole(role)}
    </span>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
  className?: string;
}) {
  const tones = {
    success: "bg-brand-mist text-brand-teal ring-brand-teal/20",
    warning: "bg-amber-50 text-amber-800 ring-amber-200",
    danger: "bg-brand-red-light text-brand-red ring-brand-red/20",
    info: "bg-brand-blue-light text-brand-blue ring-brand-blue/20",
    neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  };

  return (
    <span className={cn("stat-chip ring-1", tones[tone], className)}>{children}</span>
  );
}
