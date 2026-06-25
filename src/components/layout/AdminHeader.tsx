"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Search, User } from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/Badge";
import { formatRole } from "@/lib/utils";
import { HeaderActions } from "@/components/layout/HeaderActions";

interface AdminHeaderProps {
  user: { name: string; email: string; role: Role };
}

export function AdminHeader({ user }: AdminHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-white/10 bg-brand-ink/90 px-6 backdrop-blur-md">
      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          placeholder="Search admin panel..."
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-all focus:border-brand-teal/50 focus:ring-2 focus:ring-brand-teal/20"
        />
      </div>

      <div className="flex items-center gap-3">
        <HeaderActions variant="dark" />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-left transition-colors hover:border-brand-teal/30"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-red to-brand-teal text-xs font-bold text-white">
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-slate-100">{user.name}</p>
              <p className="text-[11px] text-slate-500">{formatRole(user.role)}</p>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-brand-ink-light shadow-xl shadow-black/40">
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-sm font-semibold text-slate-100">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
                <div className="mt-2">
                  <Badge role={user.role} />
                </div>
              </div>
              <div className="p-1.5">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
                >
                  <User className="h-4 w-4 text-brand-blue" />
                  Profile
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-brand-red/10 hover:text-brand-red-light"
                >
                  <LogOut className="h-4 w-4 text-brand-red" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
