"use client";

import { useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppLogo } from "@/components/layout/AppLogo";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { OfflineSyncBanner } from "@/components/layout/OfflineSyncBanner";
import { BackupReminderBanner } from "@/components/layout/BackupReminderBanner";
import { hasFeature } from "@/lib/role-features";

interface DashboardShellProps {
  user: { name: string; email: string; role: Role };
  children: React.ReactNode;
}

export type NavBadges = Record<string, number>;

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badges, setBadges] = useState<NavBadges>({});

  const loadBadges = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/summary");
      if (!res.ok) return;
      const data = await res.json();
      const b = data.badges ?? {};
      setBadges({
        "/dashboard/beneficiaries": b.beneficiaries ?? 0,
        "/dashboard/finance": b.finance ?? 0,
        "/dashboard/hr": b.hr ?? 0,
        "/dashboard/pending": b.pending ?? 0,
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadBadges();
    const interval = setInterval(loadBadges, 60_000);
    return () => clearInterval(interval);
  }, [loadBadges]);

  useEffect(() => {
    setMobileOpen(false);
  }, [children]);

  return (
    <div className="flex min-h-screen bg-brand-mist">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        user={user}
        badges={badges}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur lg:px-6">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 active:bg-slate-50 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 flex-1 items-center lg:hidden">
            <AppLogo href="/dashboard" variant="plain" compact className="shrink-0" />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <HeaderActions variant="light" />
            <UserProfileMenu user={user} />
          </div>
        </header>

        <BackupReminderBanner showForAdmin={hasFeature(user.role, "admin.settings")} />
        <OfflineSyncBanner />

        <main className="flex-1 overflow-auto bg-gradient-to-br from-brand-mist via-white to-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}
