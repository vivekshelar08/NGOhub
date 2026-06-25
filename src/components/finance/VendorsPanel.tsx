"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/finance-utils";

interface VendorsPanelProps {
  onFlash?: (msg: string, isError?: boolean) => void;
}

export function VendorsPanel({ onFlash }: VendorsPanelProps) {
  const [vendors, setVendors] = useState<
    Array<{ id: string; name: string; pan: string | null; billCount: number }>
  >([]);
  const [bills, setBills] = useState<
    Array<{
      id: string;
      billNumber: string;
      billDate: string;
      amount: number;
      status: string;
      vendor: { name: string };
    }>
  >([]);
  const [showVendor, setShowVendor] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: "", pan: "", email: "", phone: "" });
  const [billForm, setBillForm] = useState({
    vendorId: "",
    billNumber: "",
    billDate: new Date().toISOString().slice(0, 10),
    amount: "",
    description: "",
  });

  const flash = (m: string, e?: boolean) => onFlash?.(m, e);

  const load = useCallback(async () => {
    const [vRes, bRes] = await Promise.all([
      fetch("/api/finance/vendors"),
      fetch("/api/finance/vendor-bills"),
    ]);
    if (vRes.ok) {
      const d = await vRes.json();
      setVendors(d.vendors ?? []);
    }
    if (bRes.ok) {
      const d = await bRes.json();
      setBills(d.bills ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addVendor(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/finance/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vendorForm),
    });
    if (res.ok) {
      flash("Vendor added");
      setShowVendor(false);
      setVendorForm({ name: "", pan: "", email: "", phone: "" });
      load();
    } else flash("Failed to add vendor", true);
  }

  async function addBill(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/finance/vendor-bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...billForm,
        amount: Number(billForm.amount),
      }),
    });
    if (res.ok) {
      flash("Vendor bill created");
      setShowBill(false);
      load();
    } else flash("Failed to create bill", true);
  }

  async function approveBill(id: string) {
    const res = await fetch("/api/finance/vendor-bills", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "approve" }),
    });
    if (res.ok) {
      flash("Bill approved and posted to GL");
      load();
    } else flash("Approval failed", true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setShowVendor(!showVendor)}>
          Add vendor
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowBill(!showBill)}>
          New bill
        </Button>
      </div>

      {showVendor && (
        <Card>
          <CardTitle>New vendor</CardTitle>
          <form onSubmit={addVendor} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input
                value={vendorForm.name}
                onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>PAN</Label>
              <Input
                value={vendorForm.pan}
                onChange={(e) => setVendorForm({ ...vendorForm, pan: e.target.value })}
              />
            </div>
            <Button type="submit" className="sm:col-span-2">
              Save vendor
            </Button>
          </form>
        </Card>
      )}

      {showBill && (
        <Card>
          <CardTitle>New vendor bill</CardTitle>
          <form onSubmit={addBill} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Vendor</Label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={billForm.vendorId}
                onChange={(e) => setBillForm({ ...billForm, vendorId: e.target.value })}
                required
              >
                <option value="">Select…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Bill number</Label>
              <Input
                value={billForm.billNumber}
                onChange={(e) => setBillForm({ ...billForm, billNumber: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={billForm.billDate}
                onChange={(e) => setBillForm({ ...billForm, billDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={billForm.amount}
                onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Input
                value={billForm.description}
                onChange={(e) => setBillForm({ ...billForm, description: e.target.value })}
              />
            </div>
            <Button type="submit" className="sm:col-span-2">
              Create bill
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <CardTitle>Vendors ({vendors.length})</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {vendors.map((v) => (
            <li key={v.id} className="flex justify-between py-2">
              <span>{v.name}</span>
              <span className="text-slate-500">{v.billCount} bills</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Vendor bills</CardTitle>
        <div className="mt-2 space-y-2">
          {bills.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{b.vendor.name}</span>
                <span className="ml-2 text-slate-500">
                  {b.billNumber} · {b.billDate}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span>{formatCurrency(b.amount)}</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{b.status}</span>
                {b.status === "DRAFT" && (
                  <Button size="sm" variant="outline" onClick={() => approveBill(b.id)}>
                    Approve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
