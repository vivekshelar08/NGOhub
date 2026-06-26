"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Loader2, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/finance-utils";
import { ACCOUNT_CATEGORY_LABELS } from "@/lib/accounting-labels";
import { useFinanceMeta } from "@/hooks/useFinanceMeta";
import { AccountCategory } from "@/generated/prisma/enums";

interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  category: string;
  expenseFunction: string;
  isFcra: boolean;
  isSystem: boolean;
  isActive: boolean;
}

interface JournalEntry {
  id: string;
  voucherNumber: string;
  entryDate: string;
  description: string | null;
  sourceType: string;
  status: string;
  lines: Array<{
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    fund?: string | null;
    narration?: string | null;
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

interface JournalLineForm {
  accountCode: string;
  debit: string;
  credit: string;
  fundId: string;
  narration: string;
}

interface AccountingPanelProps {
  onFlash?: (msg: string, isError?: boolean) => void;
}

const EMPTY_LINE: JournalLineForm = {
  accountCode: "5000",
  debit: "",
  credit: "",
  fundId: "",
  narration: "",
};

export function AccountingPanel({ onFlash }: AccountingPanelProps) {
  const { meta } = useFinanceMeta();
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [subTab, setSubTab] = useState<"coa" | "journals" | "trial">("coa");
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [journalForm, setJournalForm] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    description: "",
    lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE, accountCode: "1000", debit: "", credit: "" }],
  });
  const [accountForm, setAccountForm] = useState({
    code: "",
    name: "",
    category: "EXPENSE" as AccountCategory,
    expenseFunction: "PROGRAM",
    isFcra: false,
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

  function updateJournalLine(index: number, patch: Partial<JournalLineForm>) {
    setJournalForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  }

  function addJournalLine() {
    setJournalForm((f) => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }));
  }

  function removeJournalLine(index: number) {
    setJournalForm((f) => ({
      ...f,
      lines: f.lines.length > 2 ? f.lines.filter((_, i) => i !== index) : f.lines,
    }));
  }

  async function submitJournal(e: React.FormEvent) {
    e.preventDefault();
    const lines = journalForm.lines
      .map((l) => ({
        accountCode: l.accountCode,
        debit: l.debit ? Number(l.debit) : undefined,
        credit: l.credit ? Number(l.credit) : undefined,
        fundId: l.fundId || undefined,
        narration: l.narration || undefined,
      }))
      .filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0);

    if (lines.length < 2) {
      flash("Add at least two lines with debit or credit amounts", true);
      return;
    }

    const res = await fetch("/api/finance/journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryDate: journalForm.entryDate,
        description: journalForm.description,
        lines,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      flash(`Journal posted: ${d.entry.voucherNumber}`);
      setShowJournalForm(false);
      setJournalForm({
        entryDate: new Date().toISOString().slice(0, 10),
        description: "",
        lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE, accountCode: "1000" }],
      });
      load();
    } else {
      const d = await res.json();
      flash(d.error ?? "Failed to post journal", true);
    }
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/finance/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accountForm),
    });
    if (res.ok) {
      flash("Account created");
      setShowAccountForm(false);
      setAccountForm({ code: "", name: "", category: "EXPENSE", expenseFunction: "PROGRAM", isFcra: false });
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error ?? "Failed to create account", true);
    }
  }

  async function deactivateAccount(id: string) {
    const res = await fetch("/api/finance/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: false }),
    });
    if (res.ok) {
      flash("Account deactivated");
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error ?? "Failed to deactivate", true);
    }
  }

  async function reverseEntry(id: string) {
    setReversingId(id);
    const res = await fetch(`/api/finance/journals/${id}/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Manual reversal" }),
    });
    setReversingId(null);
    if (res.ok) {
      const d = await res.json();
      flash(`Reversed — new voucher ${d.entry.voucherNumber}`);
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error ?? "Reversal failed", true);
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
          {subTab === "coa" && (
            <Button size="sm" onClick={() => setShowAccountForm(!showAccountForm)}>
              <Plus className="h-4 w-4" /> Add account
            </Button>
          )}
          {subTab === "journals" && (
            <Button size="sm" onClick={() => setShowJournalForm(!showJournalForm)}>
              <Plus className="h-4 w-4" /> Manual journal
            </Button>
          )}
        </div>
      </div>

      {showAccountForm && subTab === "coa" && (
        <Card>
          <form onSubmit={createAccount} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Code</Label>
              <Input
                value={accountForm.code}
                onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={accountForm.category}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, category: e.target.value as AccountCategory })
                }
              >
                {(Object.keys(ACCOUNT_CATEGORY_LABELS) as AccountCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {ACCOUNT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Expense function</Label>
              <Select
                value={accountForm.expenseFunction}
                onChange={(e) => setAccountForm({ ...accountForm, expenseFunction: e.target.value })}
              >
                <option value="PROGRAM">Program</option>
                <option value="ADMINISTRATIVE">Administrative</option>
                <option value="FUNDRAISING">Fundraising</option>
                <option value="NONE">None</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={accountForm.isFcra}
                onChange={(e) => setAccountForm({ ...accountForm, isFcra: e.target.checked })}
              />
              FCRA account
            </label>
            <Button type="submit" className="sm:col-span-2">
              Create account
            </Button>
          </form>
        </Card>
      )}

      {showJournalForm && subTab === "journals" && (
        <Card>
          <form onSubmit={submitJournal} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={journalForm.entryDate}
                  onChange={(e) => setJournalForm({ ...journalForm, entryDate: e.target.value })}
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
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Journal lines</p>
                <Button type="button" size="sm" variant="outline" onClick={addJournalLine}>
                  <Plus className="h-3.5 w-3.5" /> Add line
                </Button>
              </div>
              {journalForm.lines.map((line, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-6"
                >
                  <div className="sm:col-span-2">
                    <Label>Account</Label>
                    <Select
                      value={line.accountCode}
                      onChange={(e) => updateJournalLine(index, { accountCode: e.target.value })}
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.code}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Debit (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.debit}
                      onChange={(e) => updateJournalLine(index, { debit: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Credit (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.credit}
                      onChange={(e) => updateJournalLine(index, { credit: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Fund</Label>
                    <Select
                      value={line.fundId}
                      onChange={(e) => updateJournalLine(index, { fundId: e.target.value })}
                    >
                      <option value="">None</option>
                      {meta?.funds.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.code}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label>Narration</Label>
                      <Input
                        value={line.narration}
                        onChange={(e) => updateJournalLine(index, { narration: e.target.value })}
                      />
                    </div>
                    {journalForm.lines.length > 2 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => removeJournalLine(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button type="submit">Post journal entry</Button>
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
                <th className="py-2 pr-4">FCRA</th>
                <th className="py-2">Actions</th>
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
                  <td className="py-2 pr-4">{a.isFcra ? "Yes" : "—"}</td>
                  <td className="py-2">
                    {!a.isSystem && a.isActive !== false && (
                      <Button size="sm" variant="outline" onClick={() => deactivateAccount(a.id)}>
                        Deactivate
                      </Button>
                    )}
                  </td>
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
                    {e.status === "REVERSED" && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                        Reversed
                      </span>
                    )}
                  </div>
                  {e.status === "POSTED" && e.sourceType === "MANUAL" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reversingId === e.id}
                      onClick={() => reverseEntry(e.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {reversingId === e.id ? "Reversing…" : "Reverse"}
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-700">{e.description}</p>
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  {e.lines.map((l, i) => (
                    <div key={i} className="flex justify-between">
                      <span>
                        {l.accountCode} {l.accountName}
                        {l.fund && <span className="ml-1 text-slate-400">({l.fund})</span>}
                        {l.narration && <span className="ml-1 italic">— {l.narration}</span>}
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
