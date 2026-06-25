"use client";

import { useCallback, useEffect, useState } from "react";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { PageHeader, PageShell } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";

interface Asset {
  id: string;
  name: string;
  category: string;
  serialNumber: string | null;
  projectId: string | null;
  location: string | null;
  value: number | null;
  status: string;
}

export function AssetsView() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Equipment", location: "", value: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/assets");
    if (res.ok) {
      const data = await res.json();
      setAssets(data.assets ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        category: form.category,
        location: form.location || undefined,
        value: form.value ? Number(form.value) : undefined,
      }),
    });
    if (res.ok) {
      setForm({ name: "", category: "Equipment", location: "", value: "" });
      setShowForm(false);
      load();
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Assets & procurement"
        description="Track equipment, vehicles, and fixed assets linked to projects."
        actions={
          <Button type="button" size="sm" variant="teal" className="gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Register asset
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Asset name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <Label>Value (₹)</Label>
              <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
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
      ) : assets.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-500">No assets registered yet.</Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-slate-400" />
                      <span className="font-medium">{a.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.category}</td>
                  <td className="px-4 py-3 text-slate-600">{a.location ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {a.value != null ? `₹${a.value.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={a.status === "ACTIVE" ? "success" : "neutral"}>{a.status}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
