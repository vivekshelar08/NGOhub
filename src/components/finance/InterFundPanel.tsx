"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { useFinanceMeta } from "@/hooks/useFinanceMeta";

interface InterFundPanelProps {
  onFlash?: (msg: string, isError?: boolean) => void;
}

export function InterFundPanel({ onFlash }: InterFundPanelProps) {
  const { meta } = useFinanceMeta();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fromFundId: "",
    toFundId: "",
    amount: "",
    entryDate: new Date().toISOString().slice(0, 10),
    description: "",
  });

  const flash = (m: string, e?: boolean) => onFlash?.(m, e);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.fromFundId || !form.toFundId || !amount || amount <= 0) {
      flash("Select funds and enter a valid amount", true);
      return;
    }
    if (form.fromFundId === form.toFundId) {
      flash("From and to funds must be different", true);
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/finance/inter-fund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromFundId: form.fromFundId,
        toFundId: form.toFundId,
        amount,
        entryDate: form.entryDate,
        description: form.description,
      }),
    });
    setSubmitting(false);

    if (res.ok) {
      const d = await res.json();
      flash(`Inter-fund transfer posted: ${d.entry.voucherNumber}`);
      setForm({
        fromFundId: "",
        toFundId: "",
        amount: "",
        entryDate: new Date().toISOString().slice(0, 10),
        description: "",
      });
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error ?? "Transfer failed", true);
    }
  }

  return (
    <Card>
      <CardTitle>Inter-fund transfer</CardTitle>
      <p className="mt-1 text-sm text-slate-500">
        Move funds between restricted/unrestricted accounts with a GL journal entry.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label>From fund</Label>
          <Select
            value={form.fromFundId}
            onChange={(e) => setForm({ ...form, fromFundId: e.target.value })}
            required
          >
            <option value="">Select…</option>
            {meta?.funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code} — {f.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>To fund</Label>
          <Select
            value={form.toFundId}
            onChange={(e) => setForm({ ...form, toFundId: e.target.value })}
            required
          >
            <option value="">Select…</option>
            {meta?.funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code} — {f.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Amount (₹)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={form.entryDate}
            onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Description</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Purpose of transfer"
            required
          />
        </div>
        <Button type="submit" disabled={submitting} className="sm:col-span-2">
          {submitting ? "Posting…" : "Post transfer"}
        </Button>
      </form>
    </Card>
  );
}
