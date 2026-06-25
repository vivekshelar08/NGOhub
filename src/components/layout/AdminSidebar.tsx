"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ScrollText,
  Settings,
  FolderKanban,
  HandCoins,
  UserCog,
} from "lucide-react";
import { cn, getActiveNavHref } from "@/lib/utils";
import { Role } from "@/generated/prisma/enums";
import { ADMIN_NAV_SECTIONS, getAdminSidebarNavItems } from "@/lib/role-features";
import { AppLogo } from "@/components/layout/AppLogo";

const ADMIN_NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/admin": LayoutDashboard,
  "/admin/users": UserCog,
  "/admin/projects": FolderKanban,
  "/admin/donors": HandCoins,
  "/admin/logs": ScrollText,
  "/admin/settings": Settings,
};

interface AdminSidebarProps {
  role: Role;
}

export function AdminSidebar({ role }: AdminSidebarProps) {
  const pathname = usePathname();
  const navItems = getAdminSidebarNavItems(role);
  const activeHref = getActiveNavHref(pathname, navItems);
  const navByHref = Object.fromEntries(navItems.map((item) => [item.href, item]));

  return (
    <aside className="flex w-[17.5rem] shrink-0 flex-col border-r border-brand-ink-light bg-gradient-to-b from-brand-ink via-brand-ink-light to-brand-ink text-white">
      <div className="border-b border-white/10 px-4 py-5">
        <AppLogo href="/admin" priority variant="plain" className="mx-auto" />
        <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-brand-red-light/90">
          Admin Console
        </p>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {ADMIN_NAV_SECTIONS.map((section) => {
          const items = section.hrefs
            .map((href) => navByHref[href])
            .filter((item): item is NonNullable<typeof item> => Boolean(item));

          if (items.length === 0) return null;

          return (
            <div key={section.title ?? "overview"}>
              {section.title && (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {section.title}
                </p>
              )}
              <div className="space-y-1">
                {items.map((item) => {
                  const active = activeHref === item.href;
                  const Icon = ADMIN_NAV_ICONS[item.href] ?? Users;

                  return (
                    <Link
                      key={item.href}
                      href={item.soon ? "#" : item.href}
                      className={cn(
                        "nav-link group",
                        active ? "admin-nav-link-active" : "nav-link-idle",
                        item.soon && "cursor-not-allowed opacity-50"
                      )}
                      onClick={(e) => item.soon && e.preventDefault()}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 transition-colors",
                          active ? "text-brand-teal-light" : "text-slate-500 group-hover:text-slate-300"
                        )}
                      />
                      <span>{item.label}</span>
                      {item.soon && (
                        <span className="ml-auto text-[10px] uppercase text-slate-600">Soon</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <Link
          href="/dashboard"
          className="flex items-center justify-center rounded-xl border border-brand-teal/30 bg-brand-teal/10 px-3 py-2.5 text-xs font-semibold text-brand-teal-light transition-colors hover:bg-brand-teal/20"
        >
          ← Back to main app
        </Link>
      </div>
    </aside>
  );
}
