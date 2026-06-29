export type LeaveTypeCode = "CL" | "SL" | "EL";

export interface LeaveTypeBalance {
  total: number;
  used: number;
  pending: number;
  available: number;
}

export interface LeaveBalanceSummary {
  year: number;
  casual: LeaveTypeBalance;
  sick: LeaveTypeBalance;
  earned: LeaveTypeBalance;
}

const LEAVE_TYPE_TO_KEY: Record<LeaveTypeCode, keyof Pick<LeaveBalanceSummary, "casual" | "sick" | "earned">> = {
  CL: "casual",
  SL: "sick",
  EL: "earned",
};

export function countLeaveDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

type LeaveBalanceRecord = {
  year: number;
  casualLeaveTotal: number;
  casualLeaveUsed: number;
  sickLeaveTotal: number;
  sickLeaveUsed: number;
  earnedLeaveTotal: number;
  earnedLeaveUsed: number;
};

type PendingLeaveApplication = {
  leaveType: string;
  days: { toString(): string };
  startDate: Date;
  status: string;
};

export function sumPendingLeaveDays(
  applications: PendingLeaveApplication[],
  year: number
): Record<LeaveTypeCode, number> {
  const sums: Record<LeaveTypeCode, number> = { CL: 0, SL: 0, EL: 0 };

  for (const application of applications) {
    if (application.status !== "PENDING") continue;
    if (application.startDate.getFullYear() !== year) continue;
    if (application.leaveType !== "CL" && application.leaveType !== "SL" && application.leaveType !== "EL") {
      continue;
    }
    sums[application.leaveType] += Number(application.days.toString());
  }

  return sums;
}

function toTypeBalance(total: number, used: number, pending: number): LeaveTypeBalance {
  return {
    total,
    used,
    pending,
    available: Math.max(0, total - used - pending),
  };
}

export function buildLeaveBalanceSummary(
  balance: LeaveBalanceRecord,
  pendingByType: Record<LeaveTypeCode, number>
): LeaveBalanceSummary {
  return {
    year: balance.year,
    casual: toTypeBalance(balance.casualLeaveTotal, balance.casualLeaveUsed, pendingByType.CL),
    sick: toTypeBalance(balance.sickLeaveTotal, balance.sickLeaveUsed, pendingByType.SL),
    earned: toTypeBalance(balance.earnedLeaveTotal, balance.earnedLeaveUsed, pendingByType.EL),
  };
}

export function getLeaveTypeBalance(
  summary: LeaveBalanceSummary,
  leaveType: LeaveTypeCode
): LeaveTypeBalance {
  return summary[LEAVE_TYPE_TO_KEY[leaveType]];
}
