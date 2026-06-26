"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Label, Textarea } from "@/components/ui/Input";
import { ExpenseCard, ExpenseRecord } from "@/components/finance/ExpenseList";

interface ExpenseApprovalPanelProps {
  onFlash: (msg: string, isError?: boolean) => void;
}

export function ExpenseApprovalPanel({ onFlash }: ExpenseApprovalPanelProps) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/finance/expenses?all=1&status=PENDING");
    if (res.ok) {
      const data = await res.json();
      setExpenses(data.expenses ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAction(id: string, action: "approve" | "reject") {
    setLoading(true);
    const res = await fetch("/api/finance/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        action,
        reviewNotes: action === "reject" ? rejectNotes[id] || undefined : undefined,
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      onFlash(data.error ?? "Action failed", true);
      return;
    }

    const data = await res.json();
    let msg = action === "approve" ? "Expense approved" : "Expense rejected";
    if (data.journalWarning) {
      msg += ` — ${data.journalWarning}`;
      onFlash(msg, true);
    } else {
      onFlash(msg);
    }
    setRejectNotes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    load();
  }

  return (
    <Card>
      <CardTitle className="mb-1 text-lg">Pending Approvals</CardTitle>
      <p className="mb-4 text-sm text-slate-500">
        Review submitted expenses and approve or reject with bill proof attached.
      </p>

      {expenses.length === 0 ? (
        <p className="text-sm text-slate-500">No pending expenses to review.</p>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <div key={expense.id}>
              <ExpenseCard expense={expense} showEmployee />
              <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
                <Label htmlFor={`reject-notes-${expense.id}`}>Reject notes (optional)</Label>
                <Textarea
                  id={`reject-notes-${expense.id}`}
                  className="mt-1 min-h-[60px]"
                  value={rejectNotes[expense.id] ?? ""}
                  onChange={(e) =>
                    setRejectNotes((prev) => ({ ...prev, [expense.id]: e.target.value }))
                  }
                  placeholder="Reason for rejection, if applicable"
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    disabled={loading}
                    onClick={() => handleAction(expense.id, "approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => handleAction(expense.id, "reject")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
