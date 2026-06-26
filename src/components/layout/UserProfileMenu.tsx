"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { cn } from "@/lib/utils";

interface UserProfileMenuProps {
  user: { name: string; email: string; role: Role };
}

interface ProfileInfo {
  designation: string | null;
}

export function UserProfileMenu({ user }: UserProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.profile) setProfile(data.profile);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 ring-2 ring-transparent transition hover:border-brand-teal/30 hover:ring-brand-teal/20 focus:outline-none focus:ring-brand-teal/40 sm:pr-3"
        aria-label="Open profile menu"
        aria-expanded={open}
      >
        <UserAvatar name={user.name} size="sm" />
        <span className="hidden max-w-[8rem] truncate text-sm font-medium text-slate-800 sm:inline">
          {user.name.split(" ")[0]}
        </span>
        <ChevronDown
          className={cn(
            "hidden h-4 w-4 text-slate-400 transition-transform sm:block",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate font-semibold text-slate-900">{user.name}</p>
            {profile?.designation && (
              <p className="mt-0.5 truncate text-sm text-slate-500">{profile.designation}</p>
            )}
            <p className="mt-1 truncate text-xs text-slate-400">{user.email}</p>
          </div>
          <div className="p-1">
            <Link
              href="/dashboard/profile"
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <User className="h-4 w-4 text-slate-400" />
              Profile
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                "flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              )}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
