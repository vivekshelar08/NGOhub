"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Inbox } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader, PageShell } from "@/components/ui/PageHeader";
import { WalkthroughHost } from "@/components/ui/WalkthroughHost";
import { cn } from "@/lib/utils";

interface PendingItem {
  id: string;
  module: string;
  title: string;
  subtitle?: string;
  href: string;
  priority: "high" | "normal";
  dueDate?: string;
}

export function PendingInboxView() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/pending-inbox");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageShell>
      <WalkthroughHost module="pending" />
      <PageHeader
        title="Pending inbox"
        description="All items waiting for your action — across beneficiaries, finance, HR, compliance, and donors."
      />

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <Inbox className="h-10 w-10 text-brand-teal/40" />
          <p className="text-sm text-slate-600">Nothing pending right now. You&apos;re all caught up.</p>
        </Card>
      ) : (
        <ul className="space-y-2" data-walkthrough="inbox">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-brand-mist/80",
                  item.priority === "high"
                    ? "border-red-200 bg-red-50/50"
                    : "border-slate-200 bg-white"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {item.priority === "high" && (
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                    )}
                    <span className="text-xs font-medium uppercase tracking-wide text-brand-teal">
                      {item.module}
                    </span>
                  </div>
                  <p className="mt-0.5 font-medium text-slate-900">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-sm text-slate-500">{item.subtitle}</p>
                  )}
                </div>
                {item.dueDate && (
                  <span className="text-xs text-slate-500">Due {item.dueDate}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
