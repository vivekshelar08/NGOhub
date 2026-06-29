"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { PageHeader, PageShell } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { SubGrantPanel } from "@/components/partners/SubGrantPanel";

interface Partner {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  dueDiligenceStatus: string;
  has80G: boolean;
  hasFcra: boolean;
  hasDarpan: boolean;
  notes: string | null;
}

export function PartnersView() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", contactPerson: "", email: "", phone: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/partners");
    if (res.ok) {
      const data = await res.json();
      setPartners(data.partners ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const res = await fetch("/api/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ name: "", contactPerson: "", email: "", phone: "" });
      setShowForm(false);
      load();
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Partner NGOs"
        description="Sub-grantees and implementing partners — track due diligence and registration status."
        actions={
          <Button type="button" size="sm" variant="teal" className="gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Add partner
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Organization name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label>Contact person</Label>
              <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" variant="teal">Save</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : partners.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-500">
          No partners registered yet.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {partners.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 text-brand-teal" />
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  {p.contactPerson && <p className="text-sm text-slate-600">{p.contactPerson}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusBadge tone={p.dueDiligenceStatus === "VERIFIED" ? "success" : "warning"}>
                      {p.dueDiligenceStatus}
                    </StatusBadge>
                    {p.has80G && <StatusBadge tone="info">80G</StatusBadge>}
                    {p.hasFcra && <StatusBadge tone="info">FCRA</StatusBadge>}
                    {p.hasDarpan && <StatusBadge tone="info">DARPAN</StatusBadge>}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SubGrantPanel />
    </PageShell>
  );
}
