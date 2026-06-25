import { Role } from "@/generated/prisma/enums";

/** Admin and manager can approve any delivery; others only their own entries. */
export function canManageDelivery(
  role: Role,
  userId: string,
  enteredById: string
): boolean {
  if (role === "ADMIN" || role === "MANAGER") return true;
  return enteredById === userId;
}

export function assertCanManageDelivery(
  role: Role,
  userId: string,
  enteredById: string
): void {
  if (!canManageDelivery(role, userId, enteredById)) {
    throw new Error("You can only approve or update your own entries");
  }
}

/** Staff and coordinators only see their own items in the recheck queue. */
export function deliveryScopeOwnOnly(role: Role): boolean {
  return role === "STAFF" || role === "COORDINATOR";
}
