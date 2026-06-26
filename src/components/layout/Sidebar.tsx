"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Wallet,
  ClipboardList,
  BarChart3,
  UserCircle,
  Users,
  UserCog,
  Shield,
  FileQuestion,
  Scale,
  HeartHandshake,
  X,
} from "lucide-react";
import { cn, getActiveNavHref } from "@/lib/utils";
import { Role } from "@/generated/prisma/enums";
import { getNavItemsForRole } from "@/lib/role-features";
import { AppLogo } from "@/components/layout/AppLogo";
import type { NavBadges } from "@/components/layout/DashboardShell";

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/projects": FolderKanban,
  "/dashboard/beneficiaries": Users,
  "/dashboard/activities": ClipboardList,
  "/dashboard/finance": Wallet,
  "/dashboard/hr": UserCircle,
  "/dashboard/reports": BarChart3,
  "/dashboard/surveys": FileQuestion,
  "/dashboard/compliance": Scale,
  "/dashboard/volunteers": HeartHandshake,
  "/admin/users": UserCog,
  "/admin": Shield,
};

interface SidebarProps {
  user: { name: string; email: string; role: Role };
  badges?: NavBadges;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ user, badges = {}, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const visible = getNavItemsForRole(user.role);

  const activeHref = getActiveNavHref(pathname, visible);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[17.5rem] shrink-0 flex-col border-r border-brand-ink-light bg-gradient-to-b from-brand-ink via-brand-ink to-brand-teal-dark text-white transition-transform duration-200 lg:static lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="relative border-b border-white/10 px-4 py-4">
        {onMobileClose && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={onMobileClose}
            className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <div className="flex justify-center pr-8 lg:pr-0">
          <AppLogo
            href="/dashboard"
            priority
            variant="plain"
            className="mx-auto"
            imageClassName="h-auto w-full max-w-[11rem]"
          />
        </div>
        <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-brand-teal-light/80">
          NGO Hub
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visible.map((item) => {
          const active = activeHref === item.href;
          const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
          const badgeCount = badges[item.href] ?? 0;

          return (
            <Link
              key={item.href}
              href={item.soon ? "#" : item.href}
              onClick={() => onMobileClose?.()}
              className={cn(
                "nav-link min-h-[44px]",
                active ? "nav-link-active" : "nav-link-idle",
                item.soon && "cursor-not-allowed opacity-50"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-brand-teal-light/70")} />
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && (
                <span className="ml-auto rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-bold text-white">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
              {item.soon && (
                <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
