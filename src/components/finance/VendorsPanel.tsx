"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/finance-utils";
import { useFinanceMeta } from "@/hooks/useFinanceMeta";

interface VendorsPanelProps {
  onFlash?: (msg: string, isError?: boolean) => void;
}

export function VendorsPanel({ onFlash }: VendorsPanelProps) {
  const { meta } = useFinanceMeta();
  const [vendors, setVendors] = useState<
    Array<{ id: string; name: string; pan: string | null; billCount: number }>
  >([]);
  const [bills, setBills] = useState<
    Array<{
      id: string;
      billNumber: string;
      billDate: string;
      dueDate: string | null;
      amount: number;
      status: string;
      vendor: { name: string };
    }>
  >([]);
  const [payments, setPayments] = useState<
    Array<{
      id: string;
      paymentDate: string;
      amount: number;
      paymentMode: string | null;
      reference: string | null;
      vendor: { name: string };
    }>
  >([]);
  const [showVendor, setShowVendor] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    name: "",
    pan: "",
    email: "",
    phone: "",
    gstin: "",
    tdsSection: "",
    tdsRate: "",
  });
  const [billForm, setBillForm] = useState({
    vendorId: "",
    billNumber: "",
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    amount: "",
    tdsAmount: "",
    gstAmount: "",
    description: "",
    ledgerAccountId: "",
    fundId: "",
    financeProjectId: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    vendorId: "",
    vendorBillId: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: "",
    paymentMode: "BANK_TRANSFER",
    bankAccountId: "",
    reference: "",
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
      setPayments(d.payments ?? []);
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
      body: JSON.stringify({
        ...vendorForm,
        tdsRate: vendorForm.tdsRate ? Number(vendorForm.tdsRate) : undefined,
      }),
    });
    if (res.ok) {
      flash("Vendor added");
      setShowVendor(false);
      setVendorForm({ name: "", pan: "", email: "", phone: "", gstin: "", tdsSection: "", tdsRate: "" });
      load();
    } else flash("Failed to add vendor", true);
  }

  async function addBill(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/finance/vendor-bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId: billForm.vendorId,
        billNumber: billForm.billNumber,
        billDate: billForm.billDate,
        dueDate: billForm.dueDate || undefined,
        amount: Number(billForm.amount),
        tdsAmount: billForm.tdsAmount ? Number(billForm.tdsAmount) : undefined,
        gstAmount: billForm.gstAmount ? Number(billForm.gstAmount) : undefined,
        description: billForm.description || undefined,
        ledgerAccountId: billForm.ledgerAccountId || undefined,
        fundId: billForm.fundId || undefined,
        financeProjectId: billForm.financeProjectId || undefined,
      }),
    });
    if (res.ok) {
      flash("Vendor bill created");
      setShowBill(false);
      load();
    } else flash("Failed to create bill", true);
  }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/finance/vendor-bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "payment",
        vendorId: paymentForm.vendorId,
        vendorBillId: paymentForm.vendorBillId || undefined,
        paymentDate: paymentForm.paymentDate,
        amount: Number(paymentForm.amount),
        paymentMode: paymentForm.paymentMode,
        bankAccountId: paymentForm.bankAccountId || undefined,
        reference: paymentForm.reference || undefined,
      }),
    });
    if (res.ok) {
      flash("Vendor payment recorded and posted to GL");
      setShowPayment(false);
      load();
    } else flash("Failed to record payment", true);
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
        <Button size="sm" variant="outline" onClick={() => setShowPayment(!showPayment)}>
          Record payment
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
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={vendorForm.email}
                onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={vendorForm.phone}
                onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>GSTIN</Label>
              <Input
                value={vendorForm.gstin}
                onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })}
              />
            </div>
            <div>
              <Label>TDS section</Label>
              <Input
                value={vendorForm.tdsSection}
                onChange={(e) => setVendorForm({ ...vendorForm, tdsSection: e.target.value })}
                placeholder="e.g. 194C"
              />
            </div>
            <div>
              <Label>TDS rate (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={vendorForm.tdsRate}
                onChange={(e) => setVendorForm({ ...vendorForm, tdsRate: e.target.value })}
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
              <Select
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
              </Select>
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
              <Label>Bill date</Label>
              <Input
                type="date"
                value={billForm.billDate}
                onChange={(e) => setBillForm({ ...billForm, billDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Due date</Label>
              <Input
                type="date"
                value={billForm.dueDate}
                onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })}
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
            <div>
              <Label>TDS amount (₹)</Label>
              <Input
                type="number"
                value={billForm.tdsAmount}
                onChange={(e) => setBillForm({ ...billForm, tdsAmount: e.target.value })}
              />
            </div>
            <div>
              <Label>GST amount (₹)</Label>
              <Input
                type="number"
                value={billForm.gstAmount}
                onChange={(e) => setBillForm({ ...billForm, gstAmount: e.target.value })}
              />
            </div>
            <div>
              <Label>Expense account</Label>
              <Select
                value={billForm.ledgerAccountId}
                onChange={(e) => setBillForm({ ...billForm, ledgerAccountId: e.target.value })}
              >
                <option value="">Default</option>
                {meta?.accounts
                  .filter((a) => a.category === "EXPENSE")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
              </Select>
            </div>
            <div>
              <Label>Fund</Label>
              <Select
                value={billForm.fundId}
                onChange={(e) => setBillForm({ ...billForm, fundId: e.target.value })}
              >
                <option value="">None</option>
                {meta?.funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} — {f.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Finance project</Label>
              <Select
                value={billForm.financeProjectId}
                onChange={(e) => setBillForm({ ...billForm, financeProjectId: e.target.value })}
              >
                <option value="">None</option>
                {meta?.financeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
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

      {showPayment && (
        <Card>
          <CardTitle>Vendor payment</CardTitle>
          <form onSubmit={addPayment} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Vendor</Label>
              <Select
                value={paymentForm.vendorId}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, vendorId: e.target.value, vendorBillId: "" })
                }
                required
              >
                <option value="">Select…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Against bill (optional)</Label>
              <Select
                value={paymentForm.vendorBillId}
                onChange={(e) => setPaymentForm({ ...paymentForm, vendorBillId: e.target.value })}
              >
                <option value="">General payment</option>
                {bills
                  .filter((b) => b.status === "APPROVED")
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.billNumber} — {formatCurrency(b.amount)}
                    </option>
                  ))}
              </Select>
            </div>
            <div>
              <Label>Payment date</Label>
              <Input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Payment mode</Label>
              <Select
                value={paymentForm.paymentMode}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
              >
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
              </Select>
            </div>
            <div>
              <Label>Bank account</Label>
              <Select
                value={paymentForm.bankAccountId}
                onChange={(e) => setPaymentForm({ ...paymentForm, bankAccountId: e.target.value })}
              >
                <option value="">Default</option>
                {meta?.bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Reference</Label>
              <Input
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                placeholder="Cheque / UTR number"
              />
            </div>
            <Button type="submit" className="sm:col-span-2">
              Record payment
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
                  {b.dueDate && ` · due ${b.dueDate}`}
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

      <Card>
        <CardTitle>Vendor payments</CardTitle>
        <div className="mt-2 space-y-2">
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500">No payments recorded yet.</p>
          ) : (
            payments.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{p.vendor.name}</span>
                  <span className="ml-2 text-slate-500">
                    {p.paymentDate}
                    {p.paymentMode && ` · ${p.paymentMode}`}
                    {p.reference && ` · ${p.reference}`}
                  </span>
                </div>
                <span className="font-medium">{formatCurrency(p.amount)}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
