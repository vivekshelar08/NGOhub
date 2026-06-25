"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Cloud, Send } from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import { TEAM_MESSAGE_AUDIENCES } from "@/lib/team-messages";
import { cn, formatRole } from "@/lib/utils";

interface TeamMessage {
  id: string;
  body: string;
  audience: string;
  audienceLabel: string;
  createdAt: string;
  sender: { id: string; name: string; role: Role };
}

interface TeamMessagePanelProps {
  variant?: "light" | "dark";
}

const LAST_SEEN_KEY = "ngo-hub-team-messages-last-seen";

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

export function TeamMessagePanel({ variant = "light" }: TeamMessagePanelProps) {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [canSend, setCanSend] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("ALL");
  const [error, setError] = useState("");
  const [newCount, setNewCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/team-messages");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoadError(data.error ?? "Could not load team messages");
        return;
      }
      const data = await res.json();
      const list: TeamMessage[] = data.messages ?? [];
      setMessages(list);
      setCanSend(Boolean(data.canSend));

      const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
      const lastSeenTime = lastSeen ? new Date(lastSeen).getTime() : 0;
      const count = list.filter((m) => new Date(m.createdAt).getTime() > lastSeenTime).length;
      setNewCount(count);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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

  function markSeen() {
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    setNewCount(0);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/team-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, audience }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send message");
        return;
      }
      setBody("");
      setAudience("ALL");
      await load();
    } finally {
      setSending(false);
    }
  }

  const isDark = variant === "dark";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={`Team messages${newCount > 0 ? `, ${newCount} new` : ""}`}
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            markSeen();
            load();
          }
        }}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
          isDark
            ? "border-white/10 text-slate-400 hover:border-brand-blue/40 hover:bg-brand-blue/10 hover:text-white"
            : "border-slate-200 text-slate-600 hover:border-brand-teal/40 hover:bg-brand-mist hover:text-brand-teal"
        )}
      >
        <Cloud className="h-4 w-4" />
        {newCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-teal px-1 text-[10px] font-bold text-white">
            {newCount > 9 ? "9+" : newCount}
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
              "border-b px-4 py-3",
              isDark ? "border-white/10" : "border-slate-100"
            )}
          >
            <p className={cn("text-sm font-semibold", isDark ? "text-slate-100" : "text-brand-ink")}>
              Message team
            </p>
            <p className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-500")}>
              Broadcast updates to your colleagues
            </p>
          </div>

          {canSend && (
            <form
              onSubmit={handleSend}
              className={cn(
                "space-y-2 border-b p-3",
                isDark ? "border-white/10 bg-white/5" : "border-slate-100 bg-brand-mist/30"
              )}
            >
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal/20",
                  isDark
                    ? "border-white/10 bg-brand-ink text-slate-200"
                    : "border-slate-200 bg-white text-slate-800"
                )}
              >
                {TEAM_MESSAGE_AUDIENCES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Write a message to your team…"
                className={cn(
                  "w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal/20",
                  isDark
                    ? "border-white/10 bg-brand-ink text-slate-200 placeholder:text-slate-500"
                    : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400"
                )}
              />
              {error && <p className="text-xs text-brand-red">{error}</p>}
              <button
                type="submit"
                disabled={sending || !body.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-teal px-3 py-2 text-sm font-semibold text-white transition-opacity hover:bg-brand-teal-dark disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending ? "Sending…" : "Send to team"}
              </button>
            </form>
          )}

          <div className="max-h-72 overflow-y-auto">
            {loadError ? (
              <p className="px-4 py-6 text-center text-sm text-brand-red">{loadError}</p>
            ) : loading && messages.length === 0 ? (
              <p className={cn("px-4 py-6 text-center text-sm", isDark ? "text-slate-500" : "text-slate-500")}>
                Loading…
              </p>
            ) : messages.length === 0 ? (
              <p className={cn("px-4 py-6 text-center text-sm", isDark ? "text-slate-500" : "text-slate-500")}>
                No team messages yet.
              </p>
            ) : (
              <ul className={cn("divide-y", isDark ? "divide-white/10" : "divide-slate-100")}>
                {messages.map((message) => (
                  <li key={message.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm font-medium", isDark ? "text-slate-100" : "text-brand-ink")}>
                        {message.sender.name}
                      </p>
                      <span className={cn("shrink-0 text-[10px]", isDark ? "text-slate-500" : "text-slate-400")}>
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                    <p className={cn("mt-0.5 text-[11px]", isDark ? "text-slate-500" : "text-slate-500")}>
                      {formatRole(message.sender.role)}
                      {message.audience !== "ALL" && ` · ${message.audienceLabel}`}
                    </p>
                    <p className={cn("mt-1.5 text-sm whitespace-pre-wrap", isDark ? "text-slate-300" : "text-slate-600")}>
                      {message.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
