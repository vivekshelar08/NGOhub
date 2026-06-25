"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  variant?: "light" | "dark";
}

export function NotificationBell({ variant = "light" }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/notifications", { method: "POST" }).finally(load);
    const interval = setInterval(load, 120_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  const isDark = variant === "dark";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
          isDark
            ? "border-white/10 text-slate-400 hover:border-brand-blue/40 hover:bg-brand-blue/10 hover:text-white"
            : "border-slate-200 text-slate-600 hover:border-brand-teal/40 hover:bg-brand-mist hover:text-brand-teal"
        )}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border shadow-xl sm:w-96",
            isDark
              ? "border-white/10 bg-brand-ink-light shadow-black/40"
              : "border-slate-200 bg-white"
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between border-b px-4 py-3",
              isDark ? "border-white/10" : "border-slate-100"
            )}
          >
            <p className={cn("text-sm font-semibold", isDark ? "text-slate-100" : "text-brand-ink")}>
              Notifications
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-medium text-brand-teal hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <p className={cn("px-4 py-6 text-center text-sm", isDark ? "text-slate-500" : "text-slate-500")}>
                Loading…
              </p>
            ) : notifications.length === 0 ? (
              <p className={cn("px-4 py-6 text-center text-sm", isDark ? "text-slate-500" : "text-slate-500")}>
                No notifications yet.
              </p>
            ) : (
              <ul className={cn("divide-y", isDark ? "divide-white/10" : "divide-slate-100")}>
                {notifications.map((n) => {
                  const inner = (
                    <>
                      <p className={cn("text-sm font-medium", n.read ? "text-slate-600" : "text-brand-ink")}>
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.body}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{formatTime(n.createdAt)}</p>
                    </>
                  );

                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link
                          href={n.href}
                          onClick={() => {
                            if (!n.read) markRead(n.id);
                            setOpen(false);
                          }}
                          className={cn(
                            "block px-4 py-3 transition-colors",
                            isDark ? "hover:bg-white/5" : "hover:bg-slate-50",
                            !n.read && (isDark ? "bg-white/5" : "bg-brand-mist/40")
                          )}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => !n.read && markRead(n.id)}
                          className={cn(
                            "block w-full px-4 py-3 text-left transition-colors",
                            isDark ? "hover:bg-white/5" : "hover:bg-slate-50",
                            !n.read && (isDark ? "bg-white/5" : "bg-brand-mist/40")
                          )}
                        >
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
