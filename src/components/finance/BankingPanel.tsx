"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/finance-utils";
import { useFinanceMeta } from "@/hooks/useFinanceMeta";

interface BankingPanelProps {
  onFlash?: (msg: string, isError?: boolean) => void;
}

export function BankingPanel({ onFlash }: BankingPanelProps) {
  const { meta, reload: reloadMeta } = useFinanceMeta();
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
      reference: string | null;
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
    reference: "",
    debit: "",
    credit: "",
  });
  const [reconForm, setReconForm] = useState({
    periodEnd: new Date().toISOString().slice(0, 10),
    statementBalance: "",
    notes: "",
  });
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({
    name: "",
    accountType: "DOMESTIC",
    ledgerAccountId: "",
    accountNumber: "",
    ifsc: "",
    bankName: "",
    openingBalance: "",
  });
  const [postingId, setPostingId] = useState<string | null>(null);

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
        transactionDate: lineForm.transactionDate,
        description: lineForm.description || undefined,
        reference: lineForm.reference || undefined,
        debit: lineForm.debit ? Number(lineForm.debit) : 0,
        credit: lineForm.credit ? Number(lineForm.credit) : 0,
      }),
    });
    if (res.ok) {
      flash("Statement line added");
      setLineForm({
        transactionDate: lineForm.transactionDate,
        description: "",
        reference: "",
        debit: "",
        credit: "",
      });
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
        notes: reconForm.notes || undefined,
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

  async function postToGl(lineId: string) {
    setPostingId(lineId);
    const res = await fetch("/api/finance/banking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "post_journal", statementLineId: lineId }),
    });
    setPostingId(null);
    if (res.ok) {
      const d = await res.json();
      flash(`Posted to GL: ${d.entry.voucherNumber}`);
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error ?? "Failed to post journal", true);
    }
  }

  async function createBankAccount(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/finance/banking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_bank",
        name: bankForm.name,
        accountType: bankForm.accountType,
        ledgerAccountId: bankForm.ledgerAccountId,
        accountNumber: bankForm.accountNumber || undefined,
        ifsc: bankForm.ifsc || undefined,
        bankName: bankForm.bankName || undefined,
        openingBalance: bankForm.openingBalance ? Number(bankForm.openingBalance) : 0,
      }),
    });
    if (res.ok) {
      flash("Bank account created");
      setShowBankForm(false);
      setBankForm({
        name: "",
        accountType: "DOMESTIC",
        ledgerAccountId: "",
        accountNumber: "",
        ifsc: "",
        bankName: "",
        openingBalance: "",
      });
      reloadMeta();
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error ?? "Failed to create bank account", true);
    }
  }

  const assetAccounts =
    meta?.accounts.filter((a) => a.category === "ASSET") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <Label>Bank account</Label>
          <Select
            className="mt-1 max-w-md"
            value={selectedBank}
            onChange={(e) => setSelectedBank(e.target.value)}
          >
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.accountType}) — {b.ledgerAccount.code}
              </option>
            ))}
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowBankForm(!showBankForm)}>
          {showBankForm ? "Cancel" : "Add bank account"}
        </Button>
      </div>

      {showBankForm && (
        <Card>
          <CardTitle>Create bank account</CardTitle>
          <form onSubmit={createBankAccount} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Account name</Label>
              <Input
                value={bankForm.name}
                onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={bankForm.accountType}
                onChange={(e) => setBankForm({ ...bankForm, accountType: e.target.value })}
              >
                <option value="DOMESTIC">Domestic</option>
                <option value="FCRA">FCRA</option>
                <option value="CASH">Cash</option>
              </Select>
            </div>
            <div>
              <Label>Ledger account</Label>
              <Select
                value={bankForm.ledgerAccountId}
                onChange={(e) => setBankForm({ ...bankForm, ledgerAccountId: e.target.value })}
                required
              >
                <option value="">Select…</option>
                {assetAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Opening balance (₹)</Label>
              <Input
                type="number"
                value={bankForm.openingBalance}
                onChange={(e) => setBankForm({ ...bankForm, openingBalance: e.target.value })}
              />
            </div>
            <div>
              <Label>Account number</Label>
              <Input
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
              />
            </div>
            <div>
              <Label>IFSC</Label>
              <Input
                value={bankForm.ifsc}
                onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Bank name</Label>
              <Input
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
              />
            </div>
            <Button type="submit" className="sm:col-span-2">
              Create account
            </Button>
          </form>
        </Card>
      )}

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
            <div>
              <Label>Reference</Label>
              <Input
                value={lineForm.reference}
                onChange={(e) => setLineForm({ ...lineForm, reference: e.target.value })}
                placeholder="Cheque / UTR / ref no."
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
            <div>
              <Label>Notes</Label>
              <Textarea
                className="min-h-[60px]"
                value={reconForm.notes}
                onChange={(e) => setReconForm({ ...reconForm, notes: e.target.value })}
                placeholder="Reconciliation notes"
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
                <th className="py-2">Reference</th>
                <th className="py-2 text-right">Debit</th>
                <th className="py-2 text-right">Credit</th>
                <th className="py-2">Reconciled</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {statementLines.map((l) => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="py-2">{l.transactionDate}</td>
                  <td className="py-2">{l.description}</td>
                  <td className="py-2 text-slate-500">{l.reference ?? "—"}</td>
                  <td className="py-2 text-right">{l.debit ? formatCurrency(l.debit) : "—"}</td>
                  <td className="py-2 text-right">{l.credit ? formatCurrency(l.credit) : "—"}</td>
                  <td className="py-2">{l.isReconciled ? "✓" : "—"}</td>
                  <td className="py-2">
                    {!l.isReconciled && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={postingId === l.id}
                        onClick={() => postToGl(l.id)}
                      >
                        {postingId === l.id ? "Posting…" : "Post to GL"}
                      </Button>
                    )}
                  </td>
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
