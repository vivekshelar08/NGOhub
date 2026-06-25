"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/finance-utils";

interface BankingPanelProps {
  onFlash?: (msg: string, isError?: boolean) => void;
}

export function BankingPanel({ onFlash }: BankingPanelProps) {
  const [bankAccounts, setBankAccounts] = useState<
    Array<{
      id: string;
      name: string;
      accountType: string;
      openingBalance: number;
      ledgerAccount: { code: string; name: string };
    }>
  >([]);
  const [selectedBank, setSelectedBank] = useState("");
  const [statementLines, setStatementLines] = useState<
    Array<{
      id: string;
      transactionDate: string;
      description: string | null;
      debit: number;
      credit: number;
      isReconciled: boolean;
    }>
  >([]);
  const [reconciliations, setReconciliations] = useState<
    Array<{ periodEnd: string; statementBalance: number; bookBalance: number; difference: number }>
  >([]);
  const [lineForm, setLineForm] = useState({
    transactionDate: new Date().toISOString().slice(0, 10),
    description: "",
    debit: "",
    credit: "",
  });
  const [reconForm, setReconForm] = useState({
    periodEnd: new Date().toISOString().slice(0, 10),
    statementBalance: "",
  });

  const flash = (m: string, e?: boolean) => onFlash?.(m, e);

  const load = useCallback(async () => {
    const url = selectedBank
      ? `/api/finance/banking?bankAccountId=${selectedBank}`
      : "/api/finance/banking";
    const res = await fetch(url);
    if (res.ok) {
      const d = await res.json();
      setBankAccounts(d.bankAccounts ?? []);
      setStatementLines(d.statementLines ?? []);
      setReconciliations(d.reconciliations ?? []);
      if (!selectedBank && d.bankAccounts?.[0]) {
        setSelectedBank(d.bankAccounts[0].id);
      }
    }
  }, [selectedBank]);

  useEffect(() => {
    load();
  }, [load]);

  async function addStatementLine(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBank) return;
    const res = await fetch("/api/finance/banking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankAccountId: selectedBank,
        ...lineForm,
        debit: lineForm.debit ? Number(lineForm.debit) : 0,
        credit: lineForm.credit ? Number(lineForm.credit) : 0,
      }),
    });
    if (res.ok) {
      flash("Statement line added");
      setLineForm({ transactionDate: lineForm.transactionDate, description: "", debit: "", credit: "" });
      load();
    } else flash("Failed to add line", true);
  }

  async function reconcile(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/finance/banking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reconcile",
        bankAccountId: selectedBank,
        periodEnd: reconForm.periodEnd,
        statementBalance: Number(reconForm.statementBalance),
      }),
    });
    if (res.ok) {
      const d = await res.json();
      flash(
        `Reconciled. Difference: ${formatCurrency(Number(d.reconciliation.difference))}`
      );
      load();
    } else flash("Reconciliation failed", true);
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Bank account</Label>
        <select
          className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={selectedBank}
          onChange={(e) => setSelectedBank(e.target.value)}
        >
          {bankAccounts.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.accountType}) — {b.ledgerAccount.code}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Import statement line</CardTitle>
          <form onSubmit={addStatementLine} className="mt-3 space-y-3">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={lineForm.transactionDate}
                onChange={(e) => setLineForm({ ...lineForm, transactionDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={lineForm.description}
                onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Debit</Label>
                <Input
                  type="number"
                  value={lineForm.debit}
                  onChange={(e) => setLineForm({ ...lineForm, debit: e.target.value })}
                />
              </div>
              <div>
                <Label>Credit</Label>
                <Input
                  type="number"
                  value={lineForm.credit}
                  onChange={(e) => setLineForm({ ...lineForm, credit: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" size="sm">
              Add line
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Bank reconciliation</CardTitle>
          <form onSubmit={reconcile} className="mt-3 space-y-3">
            <div>
              <Label>Period end</Label>
              <Input
                type="date"
                value={reconForm.periodEnd}
                onChange={(e) => setReconForm({ ...reconForm, periodEnd: e.target.value })}
              />
            </div>
            <div>
              <Label>Statement balance (₹)</Label>
              <Input
                type="number"
                value={reconForm.statementBalance}
                onChange={(e) => setReconForm({ ...reconForm, statementBalance: e.target.value })}
                required
              />
            </div>
            <Button type="submit" size="sm">
              Complete reconciliation
            </Button>
          </form>
        </Card>
      </div>

      <Card>
        <CardTitle>Statement lines</CardTitle>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2">Date</th>
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Debit</th>
                <th className="py-2 text-right">Credit</th>
                <th className="py-2">Reconciled</th>
              </tr>
            </thead>
            <tbody>
              {statementLines.map((l) => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="py-2">{l.transactionDate}</td>
                  <td className="py-2">{l.description}</td>
                  <td className="py-2 text-right">{l.debit ? formatCurrency(l.debit) : "—"}</td>
                  <td className="py-2 text-right">{l.credit ? formatCurrency(l.credit) : "—"}</td>
                  <td className="py-2">{l.isReconciled ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {reconciliations.length > 0 && (
        <Card>
          <CardTitle>Reconciliation history</CardTitle>
          <ul className="mt-2 text-sm">
            {reconciliations.map((r, i) => (
              <li key={i} className="border-b border-slate-100 py-2">
                {r.periodEnd}: Stmt {formatCurrency(r.statementBalance)} · Book{" "}
                {formatCurrency(r.bookBalance)} · Diff {formatCurrency(r.difference)}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
