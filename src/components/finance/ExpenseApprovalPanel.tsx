"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { ExpenseCard, ExpenseRecord } from "@/components/finance/ExpenseList";

interface ExpenseApprovalPanelProps {
  onFlash: (msg: string, isError?: boolean) => void;
}

export function ExpenseApprovalPanel({ onFlash }: ExpenseApprovalPanelProps) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);

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
      body: JSON.stringify({ id, action }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      onFlash(data.error ?? "Action failed", true);
      return;
    }

    onFlash(action === "approve" ? "Expense approved" : "Expense rejected");
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
            <ExpenseCard
              key={expense.id}
              expense={expense}
              showEmployee
              actions={
                <>
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
                </>
              }
            />
          ))}
        </div>
      )}
    </Card>
  );
}
