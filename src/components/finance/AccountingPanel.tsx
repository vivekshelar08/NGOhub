"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Loader2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/finance-utils";
import { ACCOUNT_CATEGORY_LABELS } from "@/lib/accounting-labels";

interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  category: string;
  expenseFunction: string;
  isFcra: boolean;
  isSystem: boolean;
}

interface JournalEntry {
  id: string;
  voucherNumber: string;
  entryDate: string;
  description: string | null;
  sourceType: string;
  lines: Array<{
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
  }>;
}

interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  category: string;
  debit: number;
  credit: number;
  balance: number;
}

interface AccountingPanelProps {
  onFlash?: (msg: string, isError?: boolean) => void;
}

export function AccountingPanel({ onFlash }: AccountingPanelProps) {
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [subTab, setSubTab] = useState<"coa" | "journals" | "trial">("coa");
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [journalForm, setJournalForm] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    description: "",
    debitAccount: "5000",
    creditAccount: "1000",
    amount: "",
  });

  const flash = (msg: string, err?: boolean) => onFlash?.(msg, err);

  const load = useCallback(async () => {
    setLoading(true);
    const [statusRes, accountsRes, journalsRes, tbRes] = await Promise.all([
      fetch("/api/finance/setup"),
      fetch("/api/finance/accounts"),
      fetch("/api/finance/journals"),
      fetch("/api/finance/reports?report=trial-balance"),
    ]);
    if (statusRes.ok) {
      const d = await statusRes.json();
      setInitialized(d.initialized);
    }
    if (accountsRes.ok) {
      const d = await accountsRes.json();
      setAccounts(d.accounts ?? []);
    }
    if (journalsRes.ok) {
      const d = await journalsRes.json();
      setEntries(d.entries ?? []);
    }
    if (tbRes.ok) {
      const d = await tbRes.json();
      setTrialBalance(d.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runSetup() {
    setSetupLoading(true);
    const res = await fetch("/api/finance/setup", { method: "POST" });
    setSetupLoading(false);
    if (res.ok) {
      flash("Accounting package initialized with COA, funds, and FY");
      load();
    } else {
      flash("Setup failed", true);
    }
  }

  async function submitJournal(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(journalForm.amount);
    if (!amount || amount <= 0) {
      flash("Enter a valid amount", true);
      return;
    }
    const res = await fetch("/api/finance/journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryDate: journalForm.entryDate,
        description: journalForm.description,
        lines: [
          { accountCode: journalForm.debitAccount, debit: amount },
          { accountCode: journalForm.creditAccount, credit: amount },
        ],
      }),
    });
    if (res.ok) {
      const d = await res.json();
      flash(`Journal posted: ${d.entry.voucherNumber}`);
      setShowJournalForm(false);
      setJournalForm((f) => ({ ...f, description: "", amount: "" }));
      load();
    } else {
      const d = await res.json();
      flash(d.error ?? "Failed to post journal", true);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading accounting…
      </div>
    );
  }

  if (!initialized) {
    return (
      <Card>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-brand-teal" />
          Initialize accounting package
        </CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Set up chart of accounts, funds (Unrestricted, CSR, FCRA, Government), bank accounts,
          and the current Indian financial year.
        </p>
        <Button className="mt-4" onClick={runSetup} disabled={setupLoading}>
          {setupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Initialize accounting"}
        </Button>
      </Card>
    );
  }

  const subTabs = [
    { id: "coa" as const, label: "Chart of accounts" },
    { id: "journals" as const, label: "Journal entries" },
    { id: "trial" as const, label: "Trial balance" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 border-b border-slate-200">
          {subTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`border-b-2 px-3 py-2 text-sm font-medium ${
                subTab === t.id
                  ? "border-brand-teal text-brand-teal"
                  : "border-transparent text-slate-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {subTab === "journals" && (
            <Button size="sm" onClick={() => setShowJournalForm(!showJournalForm)}>
              <Plus className="h-4 w-4" /> Manual journal
            </Button>
          )}
        </div>
      </div>

      {showJournalForm && subTab === "journals" && (
        <Card>
          <form onSubmit={submitJournal} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={journalForm.entryDate}
                onChange={(e) => setJournalForm({ ...journalForm, entryDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={journalForm.amount}
                onChange={(e) => setJournalForm({ ...journalForm, amount: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Input
                value={journalForm.description}
                onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Debit account</Label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={journalForm.debitAccount}
                onChange={(e) => setJournalForm({ ...journalForm, debitAccount: e.target.value })}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Credit account</Label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={journalForm.creditAccount}
                onChange={(e) => setJournalForm({ ...journalForm, creditAccount: e.target.value })}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Post journal entry</Button>
            </div>
          </form>
        </Card>
      )}

      {subTab === "coa" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2">FCRA</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-mono">{a.code}</td>
                  <td className="py-2 pr-4">{a.name}</td>
                  <td className="py-2 pr-4">
                    {ACCOUNT_CATEGORY_LABELS[a.category as keyof typeof ACCOUNT_CATEGORY_LABELS] ??
                      a.category}
                  </td>
                  <td className="py-2">{a.isFcra ? "Yes" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {subTab === "journals" && (
        <div className="space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">No journal entries yet.</p>
          ) : (
            entries.map((e) => (
              <Card key={e.id}>
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <span className="font-mono text-sm font-semibold text-brand-teal">
                      {e.voucherNumber}
                    </span>
                    <span className="ml-2 text-sm text-slate-500">{e.entryDate}</span>
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      {e.sourceType}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-slate-700">{e.description}</p>
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  {e.lines.map((l, i) => (
                    <div key={i} className="flex justify-between">
                      <span>
                        {l.accountCode} {l.accountName}
                      </span>
                      <span>
                        {l.debit > 0 && `Dr ${formatCurrency(l.debit)}`}
                        {l.credit > 0 && `Cr ${formatCurrency(l.credit)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {subTab === "trial" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Account</th>
                <th className="py-2 pr-4 text-right">Debit</th>
                <th className="py-2 pr-4 text-right">Credit</th>
                <th className="py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.map((r) => (
                <tr key={r.accountCode} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-mono">{r.accountCode}</td>
                  <td className="py-2 pr-4">{r.accountName}</td>
                  <td className="py-2 pr-4 text-right">{r.debit ? formatCurrency(r.debit) : "—"}</td>
                  <td className="py-2 pr-4 text-right">
                    {r.credit ? formatCurrency(r.credit) : "—"}
                  </td>
                  <td className="py-2 text-right font-medium">{formatCurrency(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
