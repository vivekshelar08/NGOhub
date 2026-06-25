"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { PAYROLL_STATUS_LABELS } from "@/lib/hr-utils";
import { exportSalarySlipPdf } from "@/lib/salarySlipExport";
import { SalarySlipData } from "@/lib/salary-slip";

interface MySlip {
  lineId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  netPay: number | null;
  createdAt: string;
}

interface SalarySlipsPanelProps {
  onFlash: (msg: string, isError?: boolean) => void;
}

export function SalarySlipsPanel({ onFlash }: SalarySlipsPanelProps) {
  const [slips, setSlips] = useState<MySlip[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/hr/payroll/my-slips");
    if (!res.ok) return;
    const data = await res.json();
    setSlips(data.slips ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function downloadSlip(lineId: string) {
    setLoading(lineId);
    try {
      const res = await fetch(`/api/hr/payroll/slip/${lineId}`);
      if (!res.ok) {
        const data = await res.json();
        onFlash(data.error ?? "Failed to load salary slip", true);
        return;
      }
      const data = await res.json();
      await exportSalarySlipPdf(data.slip as SalarySlipData);
      onFlash("Salary slip downloaded");
    } catch {
      onFlash("Failed to generate PDF", true);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-brand-teal" />
          <CardTitle className="text-lg">My Salary Slips</CardTitle>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Download your salary slips for processed and paid payroll periods.
        </p>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Pay Period</th>
                <th className="px-4 py-3 font-medium">Net Pay</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {slips.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    No salary slips available yet. Slips appear after payroll is processed.
                  </td>
                </tr>
              ) : (
                slips.map((slip) => (
                  <tr key={slip.lineId} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      {slip.periodStart} — {slip.periodEnd}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {slip.netPay != null ? `₹${slip.netPay.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {PAYROLL_STATUS_LABELS[slip.status] ?? slip.status}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={loading === slip.lineId}
                        onClick={() => downloadSlip(slip.lineId)}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        {loading === slip.lineId ? "Generating..." : "Download PDF"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export async function downloadSalarySlipByLineId(
  lineId: string,
  onError?: (msg: string) => void
) {
  const res = await fetch(`/api/hr/payroll/slip/${lineId}`);
  if (!res.ok) {
    const data = await res.json();
    onError?.(data.error ?? "Failed to load salary slip");
    return false;
  }
  const data = await res.json();
  await exportSalarySlipPdf(data.slip as SalarySlipData);
  return true;
}
