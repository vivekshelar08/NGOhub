"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/finance-utils";

const EXPORTS = [
  {
    id: "10bd",
    label: "Form 10BD",
    description: "Annual statement of donations for 80G compliance (due 31 May)",
  },
  {
    id: "fc4",
    label: "FCRA FC-4",
    description: "Foreign contribution schedule for annual FC-4 return (due 31 Dec)",
  },
  {
    id: "112",
    label: "Form 112 prep pack",
    description: "NPO audit report data pack (replaces 10B/10BB from FY 2026-27)",
  },
] as const;

export function ComplianceExportsPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ type: string; data: unknown } | null>(null);

  async function loadExport(type: string) {
    setLoading(type);
    const res = await fetch(`/api/finance/compliance-exports?type=${type}`);
    setLoading(null);
    if (res.ok) {
      const data = await res.json();
      setPreview({ type, data });
    }
  }

  function download() {
    if (!preview) return;
    const blob = new Blob([JSON.stringify(preview.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ngo-compliance-${preview.type}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {EXPORTS.map((e) => (
          <Card key={e.id}>
            <CardTitle className="text-base">{e.label}</CardTitle>
            <p className="mt-1 text-xs text-slate-600">{e.description}</p>
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={() => loadExport(e.id)}
              disabled={loading === e.id}
            >
              {loading === e.id ? "Loading…" : "Generate"}
            </Button>
          </Card>
        ))}
      </div>

      {preview && (
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>
              {EXPORTS.find((e) => e.id === preview.type)?.label} preview
            </CardTitle>
            <Button size="sm" variant="outline" onClick={download}>
              <Download className="h-4 w-4" /> Download JSON
            </Button>
          </div>

          {preview.type === "10bd" && (
            <Form10BDPreview data={preview.data as Form10BDData} />
          )}
          {preview.type === "fc4" && <Fc4Preview data={preview.data as Fc4Data} />}
          {preview.type === "112" && <Form112Preview data={preview.data as Form112Data} />}
        </Card>
      )}
    </div>
  );
}

interface Form10BDData {
  financialYear: string;
  totalDonations: number;
  totalAmount: number;
  filingDeadline: string;
  donors: Array<{ donorName: string; amount: number; donationDate: string; receiptNumber: string }>;
}

function Form10BDPreview({ data }: { data: Form10BDData }) {
  return (
    <div className="mt-3 text-sm">
      <p>
        FY {data.financialYear} · {data.totalDonations} donors · Total{" "}
        {formatCurrency(data.totalAmount)} · Due {data.filingDeadline}
      </p>
      <table className="mt-3 w-full">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="py-1">Donor</th>
            <th className="py-1">Date</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.donors.slice(0, 20).map((d, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-1">{d.donorName}</td>
              <td className="py-1">{d.donationDate}</td>
              <td className="py-1 text-right">{formatCurrency(d.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.donors.length > 20 && (
        <p className="mt-2 text-slate-500">+ {data.donors.length - 20} more in export</p>
      )}
    </div>
  );
}

interface Fc4Data {
  financialYear: string;
  foreignContributionReceived: number;
  applicationOfFunds: number;
  adminWithinCap: boolean;
  filingDeadline: string;
}

function Fc4Preview({ data }: { data: Fc4Data }) {
  return (
    <div className="mt-3 space-y-2 text-sm">
      <p>FY {data.financialYear} · Due {data.filingDeadline}</p>
      <div className="flex justify-between">
        <span>Foreign contribution received</span>
        <span>{formatCurrency(data.foreignContributionReceived)}</span>
      </div>
      <div className="flex justify-between">
        <span>Application of funds</span>
        <span>{formatCurrency(data.applicationOfFunds)}</span>
      </div>
      <p className={data.adminWithinCap ? "text-emerald-700" : "text-red-700"}>
        Admin cap: {data.adminWithinCap ? "Within 20% limit" : "EXCEEDS limit"}
      </p>
    </div>
  );
}

interface Form112Data {
  financialYear: string;
  npoClassification: string;
  incomeAndExpenditure: { totalIncome: number; totalExpense: number; surplus: number };
  applicationOfIncome: { meets85PercentRule: boolean; programPercent: number };
  filingDeadline: string;
}

function Form112Preview({ data }: { data: Form112Data }) {
  return (
    <div className="mt-3 space-y-2 text-sm">
      <p>
        FY {data.financialYear} · Classification: <strong>{data.npoClassification}</strong> · Due{" "}
        {data.filingDeadline}
      </p>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-slate-500">Income</p>
          <p className="font-semibold">
            {formatCurrency(data.incomeAndExpenditure.totalIncome)}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Expense</p>
          <p className="font-semibold">
            {formatCurrency(data.incomeAndExpenditure.totalExpense)}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Surplus</p>
          <p className="font-semibold">{formatCurrency(data.incomeAndExpenditure.surplus)}</p>
        </div>
      </div>
      <p
        className={
          data.applicationOfIncome.meets85PercentRule ? "text-emerald-700" : "text-amber-700"
        }
      >
        85% application rule:{" "}
        {data.applicationOfIncome.meets85PercentRule ? "Met" : "Review required"} (
        {data.applicationOfIncome.programPercent.toFixed(1)}% to programs)
      </p>
    </div>
  );
}
