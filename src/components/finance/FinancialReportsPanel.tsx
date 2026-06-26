"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/finance-utils";

const REPORTS = [
  { id: "trial-balance", label: "Trial balance" },
  { id: "profit-loss", label: "Income & expenditure" },
  { id: "balance-sheet", label: "Balance sheet" },
  { id: "fund-wise", label: "Fund-wise statement" },
  { id: "functional-expense", label: "Functional expenses" },
  { id: "fcra-admin-cap", label: "FCRA 20% admin cap" },
  { id: "receipts-payments", label: "Receipts & payments" },
] as const;

function defaultFromDate() {
  const now = new Date();
  const month = now.getMonth();
  const year = month >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-01`;
}

export function FinancialReportsPanel() {
  const [report, setReport] = useState<string>("profit-loss");
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ report });
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const res = await fetch(`/api/finance/reports?${params}`);
    if (res.ok) {
      const d = await res.json();
      setData(d.data);
    }
    setLoading(false);
  }, [report, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  function downloadJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Report</Label>
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={report}
            onChange={(e) => setReport(e.target.value)}
          >
            {REPORTS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>From</Label>
          <Input
            type="date"
            className="mt-1"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <Label>To</Label>
          <Input
            type="date"
            className="mt-1"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          Refresh
        </Button>
        {data != null && (
          <Button size="sm" variant="outline" onClick={downloadJson}>
            <Download className="h-4 w-4" /> Export JSON
          </Button>
        )}
      </div>

      <Card>
        <CardTitle>{REPORTS.find((r) => r.id === report)?.label}</CardTitle>
        {loading ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : (
          <ReportRenderer report={report} data={data} />
        )}
      </Card>
    </div>
  );
}

function ReportRenderer({ report, data }: { report: string; data: unknown }) {
  if (!data) return <p className="mt-2 text-sm text-slate-500">No data</p>;

  if (report === "profit-loss") {
    const pl = data as {
      totalIncome: number;
      totalExpense: number;
      surplus: number;
      income: Array<{ accountName: string; amount: number }>;
      expenses: Array<{ accountName: string; amount: number }>;
    };
    return (
      <div className="mt-3 space-y-4 text-sm">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-slate-500">Income</p>
            <p className="text-lg font-semibold text-emerald-700">
              {formatCurrency(pl.totalIncome)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Expenses</p>
            <p className="text-lg font-semibold text-red-700">
              {formatCurrency(pl.totalExpense)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Surplus</p>
            <p className="text-lg font-semibold">{formatCurrency(pl.surplus)}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-medium">Income breakdown</p>
            {pl.income.map((r, i) => (
              <div key={i} className="flex justify-between py-1">
                <span>{r.accountName}</span>
                <span>{formatCurrency(r.amount)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="font-medium">Expense breakdown</p>
            {pl.expenses.map((r, i) => (
              <div key={i} className="flex justify-between py-1">
                <span>{r.accountName}</span>
                <span>{formatCurrency(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (report === "balance-sheet") {
    const bs = data as {
      totalAssets: number;
      totalLiabilities: number;
      totalEquity: number;
      assets: Array<{ name: string; balance: number }>;
      liabilities: Array<{ name: string; balance: number }>;
      equity: Array<{ name: string; balance: number }>;
    };
    return (
      <div className="mt-3 grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <p className="font-medium">Assets — {formatCurrency(bs.totalAssets)}</p>
          {bs.assets.map((a, i) => (
            <div key={i} className="flex justify-between py-1">
              <span>{a.name}</span>
              <span>{formatCurrency(a.balance)}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="font-medium">
            Liabilities + Equity — {formatCurrency(bs.totalLiabilities + bs.totalEquity)}
          </p>
          {bs.liabilities.map((a, i) => (
            <div key={i} className="flex justify-between py-1">
              <span>{a.name}</span>
              <span>{formatCurrency(a.balance)}</span>
            </div>
          ))}
          {bs.equity.map((a, i) => (
            <div key={i} className="flex justify-between py-1">
              <span>{a.name}</span>
              <span>{formatCurrency(a.balance)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (report === "fund-wise") {
    const funds = data as Array<{
      fundCode: string;
      fundName: string;
      income: number;
      expense: number;
      net: number;
      isFcra: boolean;
    }>;
    return (
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="py-2">Fund</th>
            <th className="py-2 text-right">Income</th>
            <th className="py-2 text-right">Expense</th>
            <th className="py-2 text-right">Net</th>
          </tr>
        </thead>
        <tbody>
          {funds.map((f) => (
            <tr key={f.fundCode} className="border-b border-slate-100">
              <td className="py-2">
                {f.fundCode} — {f.fundName}
                {f.isFcra && <span className="ml-1 text-xs text-amber-600">FCRA</span>}
              </td>
              <td className="py-2 text-right">{formatCurrency(f.income)}</td>
              <td className="py-2 text-right">{formatCurrency(f.expense)}</td>
              <td className="py-2 text-right font-medium">{formatCurrency(f.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (report === "functional-expense") {
    const fn = data as {
      program: number;
      administrative: number;
      fundraising: number;
      total: number;
    };
    return (
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Program</span>
          <span>{formatCurrency(fn.program)}</span>
        </div>
        <div className="flex justify-between">
          <span>Administrative</span>
          <span>{formatCurrency(fn.administrative)}</span>
        </div>
        <div className="flex justify-between">
          <span>Fundraising</span>
          <span>{formatCurrency(fn.fundraising)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 font-medium">
          <span>Total</span>
          <span>{formatCurrency(fn.total)}</span>
        </div>
      </div>
    );
  }

  if (report === "fcra-admin-cap") {
    const fcra = data as {
      fcraIncome: number;
      adminExpense: number;
      maxAdminAllowed: number;
      utilizationPercent: number;
      withinCap: boolean;
    };
    return (
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>FCRA income</span>
          <span>{formatCurrency(fcra.fcraIncome)}</span>
        </div>
        <div className="flex justify-between">
          <span>Admin expenses on FCRA</span>
          <span>{formatCurrency(fcra.adminExpense)}</span>
        </div>
        <div className="flex justify-between">
          <span>Max allowed (20%)</span>
          <span>{formatCurrency(fcra.maxAdminAllowed)}</span>
        </div>
        <p
          className={`rounded-lg px-3 py-2 font-medium ${
            fcra.withinCap ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {fcra.withinCap ? "Within FCRA admin cap" : "EXCEEDS FCRA 20% admin cap"} (
          {fcra.utilizationPercent.toFixed(1)}% utilized)
        </p>
      </div>
    );
  }

  return (
    <pre className="mt-3 max-h-96 overflow-auto rounded bg-slate-50 p-3 text-xs">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
