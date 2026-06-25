"use client";

import { cn } from "@/lib/utils";
import {
  ACHIEVEMENT_STATUS_LABELS,
  ACHIEVEMENT_STATUS_STYLES,
  AchievementOverview,
  AchievementStatus,
  AchievementStatusBucket,
  ProjectAchievement,
} from "@/lib/achievements";
import { formatSdgLabel } from "@/lib/sdg";

interface ProgressBarProps {
  label: string;
  achieved: number;
  target: number;
  pct: number | null;
  color?: string;
}

export function ProgressBar({ label, achieved, target, pct, color = "#10b981" }: ProgressBarProps) {
  const width = pct ?? 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500">
          {achieved.toLocaleString("en-IN")} / {target.toLocaleString("en-IN")}
          {pct !== null && <span className="ml-2 font-semibold text-slate-800">{pct}%</span>}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface StatusDonutProps {
  byStatus: AchievementOverview["byStatus"];
  activeStatus: AchievementStatusBucket;
  onSelect: (status: AchievementStatusBucket) => void;
}

const STATUS_ORDER: AchievementStatus[] = [
  "COMPLETE",
  "ON_TRACK",
  "AT_RISK",
  "BEHIND",
  "NO_DATA",
];

export function StatusDonutChart({ byStatus, activeStatus, onSelect }: StatusDonutProps) {
  const total = STATUS_ORDER.reduce((sum, key) => sum + byStatus[key], 0);
  const size = 160;
  const stroke = 28;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  const segments = STATUS_ORDER.map((key) => {
    const value = byStatus[key];
    const fraction = total > 0 ? value / total : 0;
    const dash = fraction * circumference;
    const segment = {
      key,
      value,
      dash,
      gap: circumference - dash,
      offset: -offset,
      color: ACHIEVEMENT_STATUS_STYLES[key].chart,
    };
    offset += dash;
    return segment;
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="relative shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={stroke}
          />
          {total > 0 ? (
            segments.map((seg) =>
              seg.value > 0 ? (
                <circle
                  key={seg.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${seg.dash} ${seg.gap}`}
                  strokeDashoffset={seg.offset}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onClick={() => onSelect(activeStatus === seg.key ? "ALL" : seg.key)}
                />
              ) : null
            )
          ) : (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={stroke}
            />
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-slate-900">{total}</span>
          <span className="text-xs text-slate-500">Projects</span>
        </div>
      </div>

      <ul className="flex-1 space-y-2">
        {STATUS_ORDER.map((key) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onSelect(activeStatus === key ? "ALL" : key)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                activeStatus === key ? "bg-brand-mist ring-1 ring-brand-teal/25" : "hover:bg-slate-50"
              )}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: ACHIEVEMENT_STATUS_STYLES[key].chart }}
              />
              <span className="flex-1 text-slate-700">{ACHIEVEMENT_STATUS_LABELS[key]}</span>
              <span className="tabular-nums font-semibold text-slate-900">{byStatus[key]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface HorizontalBarChartProps {
  items: { id: string; label: string; sublabel?: string; pct: number | null; value: number }[];
  barColor?: string;
  emptyMessage?: string;
}

export function HorizontalBarChart({
  items,
  barColor = "#10b981",
  emptyMessage = "No data for current filters",
}: HorizontalBarChartProps) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
              {item.sublabel && (
                <p className="truncate text-xs text-slate-500">{item.sublabel}</p>
              )}
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">
              {item.pct !== null ? `${item.pct}%` : "—"}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${item.pct ?? 0}%`, backgroundColor: barColor }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface SdgChartProps {
  bySdg: AchievementOverview["bySdg"];
  activeSdg: number | "ALL";
  onSelect: (sdg: number | "ALL") => void;
}

export function SdgAchievementChart({ bySdg, activeSdg, onSelect }: SdgChartProps) {
  if (bySdg.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No SDG data for current filters</p>;
  }

  const maxPct = Math.max(...bySdg.map((s) => s.overallPct ?? 0), 1);

  return (
    <div className="space-y-2">
      {bySdg.map((row) => {
        const barWidth = row.overallPct !== null ? (row.overallPct / maxPct) * 100 : 0;
        const isActive = activeSdg === row.sdgId;

        return (
          <button
            key={row.sdgId}
            type="button"
            onClick={() => onSelect(isActive ? "ALL" : row.sdgId)}
            className={cn(
              "block w-full rounded-lg p-2 text-left transition-colors",
              isActive ? "bg-brand-mist ring-1 ring-brand-teal/25" : "hover:bg-slate-50"
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-700">{formatSdgLabel(row.sdgId)}</span>
              <span className="tabular-nums text-slate-500">
                {row.achievedBeneficiaries.toLocaleString("en-IN")} /{" "}
                {row.targetBeneficiaries.toLocaleString("en-IN")} ben.
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-mist transition-all duration-500"
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {row.projectCount} project{row.projectCount !== 1 ? "s" : ""} ·{" "}
              {row.overallPct !== null ? `${row.overallPct}%` : "—"}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export function StatusBadge({ status }: { status: AchievementStatus }) {
  const styles = ACHIEVEMENT_STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
        styles.badge
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
      {ACHIEVEMENT_STATUS_LABELS[status]}
    </span>
  );
}

interface MilestoneBreakdownProps {
  achievements: ProjectAchievement[];
}

export function MilestoneBreakdownChart({ achievements }: MilestoneBreakdownProps) {
  const rows = achievements.flatMap((project) =>
    project.milestones.map((m) => ({
      id: `${project.projectId}-${m.milestoneId}`,
      label: m.milestoneName,
      sublabel: project.projectTitle,
      pct: m.overallPct,
      value: m.overallPct ?? 0,
    }))
  );

  return (
    <HorizontalBarChart
      items={rows.slice(0, 12)}
      emptyMessage="No milestones for current filters"
    />
  );
}
