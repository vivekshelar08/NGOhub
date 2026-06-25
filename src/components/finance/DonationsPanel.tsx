"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { generate80GReceiptDocx } from "@/lib/donationReceipt";
import { formatCurrency } from "@/lib/finance-utils";

interface Donation {
  id: string;
  donorName: string;
  donorPan: string | null;
  amount: number;
  donationDate: string;
  paymentMode: string | null;
  purpose: string | null;
  receiptNumber: string;
  is80GEligible: boolean;
  recordedBy: { id: string; name: string };
}

interface DonationsPanelProps {
  onFlash?: (msg: string, isError?: boolean) => void;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function DonationsPanel({ onFlash }: DonationsPanelProps) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [orgSettings, setOrgSettings] = useState<{
    orgName?: string;
    orgAddress?: string;
    orgPan?: string;
    org80G?: string;
  }>({});

  useEffect(() => {
    fetch("/api/org-settings")
      .then((r) => r.json())
      .then((d) => setOrgSettings(d.settings ?? {}))
      .catch(() => {});
  }, []);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    donorName: "",
    donorPan: "",
    amount: "",
    donationDate: new Date().toISOString().slice(0, 10),
    paymentMode: "UPI",
    purpose: "",
    is80GEligible: true,
  });

  const flash = (msg: string, error?: boolean) => onFlash?.(msg, error);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/donations");
    if (res.ok) {
      const data = await res.json();
      setDonations(data.donations ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.donorName.trim() || !amount || amount <= 0) {
      flash("Enter donor name and a valid amount.", true);
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        donorName: form.donorName.trim(),
        donorPan: form.donorPan || undefined,
        amount,
        donationDate: form.donationDate,
        paymentMode: form.paymentMode || undefined,
        purpose: form.purpose || undefined,
        is80GEligible: form.is80GEligible,
      }),
    });
    setSubmitting(false);

    if (res.ok) {
      flash("Donation recorded.");
      setForm({
        donorName: "",
        donorPan: "",
        amount: "",
        donationDate: new Date().toISOString().slice(0, 10),
        paymentMode: "UPI",
        purpose: "",
        is80GEligible: true,
      });
      setShowForm(false);
      load();
    } else {
      flash("Failed to record donation.", true);
    }
  }

  async function handleDownloadReceipt(donation: Donation) {
    if (!donation.is80GEligible) {
      flash("This donation is not marked 80G eligible.", true);
      return;
    }
    setDownloadingId(donation.id);
    try {
      const blob = await generate80GReceiptDocx({
        receiptNumber: donation.receiptNumber,
        donorName: donation.donorName,
        donorPan: donation.donorPan ?? undefined,
        amount: donation.amount,
        donationDate: new Date(donation.donationDate).toLocaleDateString("en-IN"),
        paymentMode: donation.paymentMode ?? undefined,
        purpose: donation.purpose ?? undefined,
        orgName: orgSettings.orgName,
        orgAddress: orgSettings.orgAddress,
        orgPan: orgSettings.orgPan,
        org80G: orgSettings.org80G,
      });
      downloadBlob(blob, `${donation.receiptNumber}.docx`);
    } catch {
      flash("Failed to generate receipt.", true);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <IndianRupee className="h-5 w-5 text-brand-teal" />
          Donations
        </CardTitle>
        <Button type="button" size="sm" variant={showForm ? "outline" : "teal"} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Record donation"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="donor-name">Donor name *</Label>
                <Input
                  id="donor-name"
                  value={form.donorName}
                  onChange={(e) => setForm((f) => ({ ...f, donorName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="donor-pan">Donor PAN</Label>
                <Input
                  id="donor-pan"
                  value={form.donorPan}
                  onChange={(e) => setForm((f) => ({ ...f, donorPan: e.target.value.toUpperCase() }))}
                  maxLength={10}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="donation-amount">Amount (₹) *</Label>
                <Input
                  id="donation-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="donation-date">Date *</Label>
                <Input
                  id="donation-date"
                  type="date"
                  value={form.donationDate}
                  onChange={(e) => setForm((f) => ({ ...f, donationDate: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="payment-mode">Payment mode</Label>
                <Input
                  id="payment-mode"
                  value={form.paymentMode}
                  onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value }))}
                  placeholder="UPI, Cheque…"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="donation-purpose">Purpose</Label>
              <Input
                id="donation-purpose"
                value={form.purpose}
                onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.is80GEligible}
                onChange={(e) => setForm((f) => ({ ...f, is80GEligible: e.target.checked }))}
                className="rounded border-slate-300"
              />
              Eligible for 80G receipt
            </label>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save donation"}
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading donations…</p>
      ) : donations.length === 0 ? (
        <p className="text-sm text-slate-500">No donations recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {donations.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
            >
              <div>
                <p className="font-semibold text-brand-ink">{d.donorName}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {new Date(d.donationDate).toLocaleDateString("en-IN")}
                  {d.paymentMode && ` · ${d.paymentMode}`}
                  {d.purpose && ` · ${d.purpose}`}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Receipt {d.receiptNumber} · recorded by {d.recordedBy.name}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="text-lg font-bold tabular-nums text-brand-teal">
                  {formatCurrency(d.amount)}
                </p>
                {d.is80GEligible && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={downloadingId === d.id}
                    onClick={() => handleDownloadReceipt(d)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloadingId === d.id ? "Generating…" : "80G receipt"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
