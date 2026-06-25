import { Role, UserStatus } from "@/generated/prisma/enums";

/** Roles allowed to broadcast messages to the team. */
export const TEAM_MESSAGE_SENDER_ROLES: Role[] = ["ADMIN", "MANAGER", "HR", "COORDINATOR"];

export function canSendTeamMessages(role: Role): boolean {
  return TEAM_MESSAGE_SENDER_ROLES.includes(role);
}

export const TEAM_MESSAGE_AUDIENCES: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "Everyone" },
  { value: "STAFF", label: "Field staff" },
  { value: "COORDINATOR", label: "Coordinators" },
  { value: "MANAGER", label: "Managers" },
  { value: "ACCOUNTANT", label: "Accountants" },
  { value: "HR", label: "HR team" },
  { value: "ADMIN", label: "Admins" },
];

export function audienceLabel(audience: string): string {
  return TEAM_MESSAGE_AUDIENCES.find((a) => a.value === audience)?.label ?? audience;
}

export function matchesAudience(userRole: Role, userStatus: UserStatus, audience: string): boolean {
  if (userStatus !== "ACTIVE") return false;
  if (audience === "ALL") return true;
  return userRole === audience;
}
