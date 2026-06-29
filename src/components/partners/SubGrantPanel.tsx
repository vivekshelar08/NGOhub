"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/finance-utils";
import { useFinanceMeta } from "@/hooks/useFinanceMeta";

export function SubGrantPanel() {
  const { meta } = useFinanceMeta();
  const [partners, setPartners] = useState<Array<{ id: string; name: string }>>([]);
  const [grants, setGrants] = useState<Array<{ id: string; agreementNumber: string; amount: number; partner: { name: string } }>>([]);
  const [form, setForm] = useState({
    partnerId: "",
    financeProjectId: "",
    amount: "",
    startDate: "",
    endDate: "",
    adminPercent: "7",
  });

  const load = useCallback(async () => {
    const [pRes, gRes] = await Promise.all([fetch("/api/partners"), fetch("/api/sub-grants")]);
    if (pRes.ok) setPartners((await pRes.json()).partners ?? []);
    if (gRes.ok) setGrants((await gRes.json()).grants ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    const res = await fetch("/api/sub-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_agreement",
        partnerId: form.partnerId,
        financeProjectId: form.financeProjectId,
        amount: parseFloat(form.amount),
        adminPercent: parseFloat(form.adminPercent),
        startDate: form.startDate,
        endDate: form.endDate,
      }),
    });
    if (res.ok) load();
  }

  return (
    <Card className="mt-6">
      <CardTitle className="mb-4 text-base">Sub-grant agreements</CardTitle>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label>Partner</Label>
          <Select className="mt-1" value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}>
            <option value="">Select…</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Finance project</Label>
          <Select className="mt-1" value={form.financeProjectId} onChange={(e) => setForm({ ...form, financeProjectId: e.target.value })}>
            <option value="">Select…</option>
            {meta?.financeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Amount (₹)</Label>
          <Input type="number" className="mt-1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div>
          <Label>Start</Label>
          <Input type="date" className="mt-1" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </div>
        <div>
          <Label>End</Label>
          <Input type="date" className="mt-1" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </div>
        <div>
          <Label>Admin %</Label>
          <Input type="number" className="mt-1" value={form.adminPercent} onChange={(e) => setForm({ ...form, adminPercent: e.target.value })} />
        </div>
      </div>
      <Button type="button" variant="teal" onClick={create}>
        Create sub-grant
      </Button>

      <ul className="mt-6 space-y-2 text-sm">
        {grants.map((g) => (
          <li key={g.id} className="rounded border border-slate-200 p-3">
            {g.partner.name} · {g.agreementNumber} · {formatCurrency(g.amount)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
