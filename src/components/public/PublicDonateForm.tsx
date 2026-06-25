"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export function PublicDonateForm() {
  const [orgName, setOrgName] = useState("SVITECH Foundation");
  const [form, setForm] = useState({ donorName: "", donorEmail: "", donorPan: "", amount: "", purpose: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ message: string; receiptNumber?: string } | null>(null);

  useEffect(() => {
    fetch("/api/public/donate")
      .then((r) => r.json())
      .then((d) => setOrgName(d.orgName ?? "SVITECH Foundation"))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const res = await fetch("/api/public/donate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        donorName: form.donorName,
        donorEmail: form.donorEmail || undefined,
        donorPan: form.donorPan || undefined,
        amount: Number(form.amount),
        purpose: form.purpose || undefined,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setResult({ message: data.message, receiptNumber: data.receiptNumber });
      setForm({ donorName: "", donorEmail: "", donorPan: "", amount: "", purpose: "" });
    } else {
      setResult({ message: data.error ?? "Something went wrong." });
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <Heart className="h-8 w-8 text-brand-teal" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Donate to {orgName}</h1>
          <p className="text-sm text-slate-600">Your support helps us reach more communities.</p>
        </div>
      </div>

      {result ? (
        <div className="rounded-lg bg-brand-mist p-4 text-sm text-slate-800">
          <p>{result.message}</p>
          {result.receiptNumber && (
            <p className="mt-2 font-medium">Reference: {result.receiptNumber}</p>
          )}
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setResult(null)}>
            Donate again
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Your name</Label>
            <Input value={form.donorName} onChange={(e) => setForm({ ...form, donorName: e.target.value })} required />
          </div>
          <div>
            <Label>Email (optional)</Label>
            <Input type="email" value={form.donorEmail} onChange={(e) => setForm({ ...form, donorEmail: e.target.value })} />
          </div>
          <div>
            <Label>PAN (for 80G receipt)</Label>
            <Input value={form.donorPan} onChange={(e) => setForm({ ...form, donorPan: e.target.value })} />
          </div>
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>
          <div>
            <Label>Purpose (optional)</Label>
            <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </div>
          <Button type="submit" variant="teal" className="w-full" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit donation intent"}
          </Button>
          <p className="text-xs text-slate-500">
            Online payment via Razorpay can be enabled in organization settings. Until then, our team will contact you to complete the donation.
          </p>
        </form>
      )}
    </div>
  );
}
