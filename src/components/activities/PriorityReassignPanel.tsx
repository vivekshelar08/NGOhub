"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { ActivityTask } from "@/lib/activities";
import { formatDateKey } from "@/lib/hr-utils";
import { LEAVE_TYPE_LABELS } from "@/lib/hr-types";

interface PriorityTask {
  task: ActivityTask;
  assigneeName: string;
  assigneeDepartment: string | null;
  leaveType: string;
  leaveStart: string;
  leaveEnd: string;
  isEmergency: boolean;
  priority: string;
}

interface PriorityReassignPanelProps {
  onReassign: (task: ActivityTask) => void;
  className?: string;
}

export function PriorityReassignPanel({ onReassign, className }: PriorityReassignPanelProps) {
  const [items, setItems] = useState<PriorityTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/activities/reassign-priority");
      if (res.ok) {
        const data = await res.json();
        setItems(data.tasks ?? []);
      } else {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Card className={className}>
        <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking emergency leave reassignments…
        </div>
      </Card>
    );
  }

  if (items.length === 0) return null;

  return (
    <Card className={className}>
      <div className="border-b border-red-100 bg-red-50/80 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <CardTitle className="text-base text-red-900">
              Priority reassign — staff on emergency leave
            </CardTitle>
            <p className="mt-1 text-sm text-red-800">
              {items.length} task{items.length === 1 ? "" : "s"} still assigned to people on emergency leave.
              Reassign on priority so field work is not missed.
            </p>
          </div>
        </div>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.task.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{item.task.title}</p>
              <p className="text-sm text-slate-600">{item.task.projectTitle}</p>
              <p className="mt-1 text-xs text-slate-500">
                <UserRoundCog className="mr-1 inline h-3.5 w-3.5" />
                {item.assigneeName}
                {item.assigneeDepartment ? ` · ${item.assigneeDepartment}` : ""}
                {" · "}
                {LEAVE_TYPE_LABELS[item.leaveType] ?? item.leaveType} ({item.leaveStart} → {item.leaveEnd})
              </p>
              {item.task.scheduledDate && (
                <p className="mt-0.5 text-xs text-slate-500">
                  Scheduled {formatDateKey(item.task.scheduledDate.slice(0, 10))}
                </p>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={() => onReassign(item.task)}
            >
              Reassign now
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
