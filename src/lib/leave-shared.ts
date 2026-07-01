export function isEmergencyLeave(leave: {
  leaveType: string;
  isEmergency?: boolean;
  reason?: string | null;
}): boolean {
  if (leave.isEmergency || leave.leaveType === "EM") return true;
  const reason = (leave.reason ?? "").toLowerCase();
  return reason.includes("emergency") || reason.includes("urgent");
}
