"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  flushOfflineQueue,
  pendingOfflineCount,
  type OfflineQueueAction,
} from "@/lib/offlineQueue";

export function OfflineSyncBanner() {
  const [pending, setPending] = useState(0);
  const [offline, setOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setPending(pendingOfflineCount());
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("offline-queue-updated", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("offline-queue-updated", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, [refresh]);

  async function handleFlush() {
    setSyncing(true);
    setMessage(null);

    const handlers: Partial<
      Record<OfflineQueueAction, (payload: Record<string, unknown>) => Promise<void>>
    > = {
      expense_submit: async (payload) => {
        const res = await fetch("/api/finance/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Expense sync failed");
      },
      beneficiary_feedback: async (payload) => {
        const res = await fetch("/api/beneficiary-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Feedback sync failed");
      },
      activity_complete: async (payload) => {
        const { applyOfflineTaskComplete } = await import("@/lib/activities");
        applyOfflineTaskComplete(payload);
      },
      beneficiary_register: async (payload) => {
        const res = await fetch("/api/beneficiaries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Beneficiary sync failed");
      },
      volunteer_hours: async (payload) => {
        const res = await fetch("/api/volunteers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "log_hours", ...payload }),
        });
        if (!res.ok) throw new Error("Volunteer hours sync failed");
      },
    };

    const { synced, failed } = await flushOfflineQueue(handlers);
    refresh();
    setSyncing(false);

    if (offline) {
      setMessage("You are offline. Connect to sync pending items.");
    } else if (synced > 0 && failed === 0) {
      setMessage(`Synced ${synced} item${synced === 1 ? "" : "s"}.`);
    } else if (failed > 0) {
      setMessage(`Synced ${synced}, ${failed} failed. Try again.`);
    } else {
      setMessage(null);
    }
  }

  if (pending === 0 && !offline) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 text-sm",
        offline
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-brand-teal/20 bg-brand-mist text-brand-ink"
      )}
    >
      <div className="flex items-center gap-2">
        {offline ? (
          <CloudOff className="h-4 w-4 shrink-0 text-amber-600" />
        ) : (
          <Wifi className="h-4 w-4 shrink-0 text-brand-teal" />
        )}
        <span>
          {offline
            ? `Offline — ${pending} item${pending === 1 ? "" : "s"} waiting to sync`
            : `${pending} pending item${pending === 1 ? "" : "s"} ready to sync`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {message && <span className="text-xs opacity-80">{message}</span>}
        <Button
          type="button"
          size="sm"
          variant={offline ? "outline" : "teal"}
          disabled={syncing || offline}
          className="gap-1.5"
          onClick={handleFlush}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
      </div>
    </div>
  );
}
