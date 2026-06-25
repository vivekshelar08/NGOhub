import { Role } from "@/generated/prisma/enums";

export function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
  HR: "HR",
  COORDINATOR: "Coordinator",
  STAFF: "Staff",
};

export function formatRole(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}

export function getFirstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "User";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

/** Highlight only the most specific sidebar route that matches the current path. */
export function getActiveNavHref(
  pathname: string,
  items: Array<{ href: string; exact?: boolean }>
): string | null {
  const path = (pathname.split("?")[0].replace(/\/$/, "") || "/");

  let activeHref: string | null = null;
  let activeLength = -1;

  for (const item of items) {
    const href = item.href.replace(/\/$/, "") || "/";
    const matches = item.exact
      ? path === href
      : path === href || path.startsWith(`${href}/`);

    if (matches && href.length > activeLength) {
      activeHref = item.href;
      activeLength = href.length;
    }
  }

  return activeHref;
}
