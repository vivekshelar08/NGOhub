"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/finance-utils";
import { useFinanceMeta } from "@/hooks/useFinanceMeta";
import { RAG_LABELS, RAG_STYLES, type MeIndicatorRow } from "@/lib/budgetTracking";

type SuiteSection = "grants" | "procurement" | "payroll" | "impact" | "logframe";

export function NgoSuitePanel({ onFlash }: { onFlash: (msg: string, err?: boolean) => void }) {
  const [section, setSection] = useState<SuiteSection>("grants");
  const { meta } = useFinanceMeta();
  const [financeProjectId, setFinanceProjectId] = useState("");

  const sections: Array<{ id: SuiteSection; label: string }> = [
    { id: "grants", label: "Grant agreements" },
    { id: "procurement", label: "Procurement" },
    { id: "payroll", label: "Payroll split" },
    { id: "logframe", label: "M&E logframe" },
    { id: "impact", label: "Public impact" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              section === s.id ? "bg-brand-teal text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="max-w-md">
        <Label>Finance project</Label>
        <Select className="mt-1" value={financeProjectId} onChange={(e) => setFinanceProjectId(e.target.value)}>
          <option value="">Select project…</option>
          {meta?.financeProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </Select>
      </div>

      {section === "grants" && <GrantAgreementsSection financeProjectId={financeProjectId} onFlash={onFlash} />}
      {section === "procurement" && <ProcurementSection financeProjectId={financeProjectId} onFlash={onFlash} />}
      {section === "payroll" && <PayrollSplitSection financeProjectId={financeProjectId} onFlash={onFlash} />}
      {section === "logframe" && <LogframeSection financeProjectId={financeProjectId} onFlash={onFlash} />}
      {section === "impact" && <PublicImpactSection financeProjectId={financeProjectId} onFlash={onFlash} meta={meta} />}
    </div>
  );
}

function GrantAgreementsSection({
  financeProjectId,
  onFlash,
}: {
  financeProjectId: string;
  onFlash: (msg: string, err?: boolean) => void;
}) {
  const [agreements, setAgreements] = useState<Array<{ agreementNumber: string; donorName: string; totalAmount: number; tranches: unknown[] }>>([]);
  const [form, setForm] = useState({
    donorName: "",
    totalAmount: "",
    startDate: "",
    endDate: "",
    trancheAmount: "",
    trancheDue: "",
  });

  const load = useCallback(async () => {
    const q = financeProjectId ? `?financeProjectId=${financeProjectId}` : "";
    const res = await fetch(`/api/grant-agreements${q}`);
    if (res.ok) {
      const data = await res.json();
      setAgreements(data.agreements ?? []);
    }
  }, [financeProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!financeProjectId) {
      onFlash("Select a finance project", true);
      return;
    }
    const res = await fetch("/api/grant-agreements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        financeProjectId,
        donorName: form.donorName,
        totalAmount: parseFloat(form.totalAmount),
        startDate: form.startDate,
        endDate: form.endDate,
        tranches: [{ amount: parseFloat(form.trancheAmount), dueDate: form.trancheDue }],
      }),
    });
    if (res.ok) {
      onFlash("Grant agreement created");
      load();
    } else {
      const d = await res.json();
      onFlash(d.error ?? "Failed", true);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle className="mb-4 text-base">New grant agreement</CardTitle>
        <div className="space-y-3">
          <div>
            <Label>Donor name</Label>
            <Input value={form.donorName} onChange={(e) => setForm({ ...form, donorName: e.target.value })} />
          </div>
          <div>
            <Label>Total amount (₹)</Label>
            <Input type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Start</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>First tranche amount / due</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Amount" value={form.trancheAmount} onChange={(e) => setForm({ ...form, trancheAmount: e.target.value })} />
              <Input type="date" value={form.trancheDue} onChange={(e) => setForm({ ...form, trancheDue: e.target.value })} />
            </div>
          </div>
          <Button type="button" variant="teal" onClick={create}>
            Create agreement
          </Button>
        </div>
      </Card>
      <Card>
        <CardTitle className="mb-4 text-base">Active agreements</CardTitle>
        {agreements.length === 0 ? (
          <p className="text-sm text-slate-500">No agreements yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {agreements.map((a) => (
              <li key={a.agreementNumber} className="rounded border border-slate-200 p-3">
                <p className="font-medium">{a.donorName}</p>
                <p className="text-slate-500">
                  {a.agreementNumber} · {formatCurrency(a.totalAmount)} · {a.tranches.length} tranche(s)
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ProcurementSection({
  financeProjectId,
  onFlash,
}: {
  financeProjectId: string;
  onFlash: (msg: string, err?: boolean) => void;
}) {
  const [requests, setRequests] = useState<Array<{ id: string; requestNumber: string; description: string; amount: number; status: string }>>([]);
  const [form, setForm] = useState({ description: "", amount: "", budgetHead: "" });

  const load = useCallback(async () => {
    const res = await fetch("/api/procurement");
    if (res.ok) setRequests((await res.json()).requests ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitRequest() {
    const res = await fetch("/api/procurement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_request",
        financeProjectId: financeProjectId || undefined,
        description: form.description,
        amount: parseFloat(form.amount),
        budgetHead: form.budgetHead || undefined,
      }),
    });
    if (res.ok) {
      onFlash("Purchase request submitted");
      setForm({ description: "", amount: "", budgetHead: "" });
      load();
    } else {
      const d = await res.json();
      onFlash(d.error ?? "Failed", true);
    }
  }

  async function approve(id: string) {
    const res = await fetch("/api/procurement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", requestId: id }),
    });
    if (res.ok) {
      onFlash("Request approved — budget encumbered");
      load();
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle className="mb-4 text-base">Purchase request</CardTitle>
        <div className="space-y-3">
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <Label>Budget head</Label>
            <Input value={form.budgetHead} onChange={(e) => setForm({ ...form, budgetHead: e.target.value })} />
          </div>
          <Button type="button" variant="teal" onClick={submitRequest}>
            Submit for approval
          </Button>
        </div>
      </Card>
      <Card>
        <CardTitle className="mb-4 text-base">Requests</CardTitle>
        <ul className="space-y-2 text-sm">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded border border-slate-200 p-3">
              <div>
                <p className="font-medium">{r.requestNumber}</p>
                <p className="text-slate-500">{r.description} · {formatCurrency(r.amount)}</p>
                <p className="text-xs text-slate-400">{r.status}</p>
              </div>
              {r.status === "PENDING" && (
                <Button type="button" size="sm" variant="outline" onClick={() => approve(r.id)}>
                  Approve
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function PayrollSplitSection({
  financeProjectId,
  onFlash,
}: {
  financeProjectId: string;
  onFlash: (msg: string, err?: boolean) => void;
}) {
  const [employeeUserId, setEmployeeUserId] = useState("");
  const [percent, setPercent] = useState("");
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const now = new Date();

  useEffect(() => {
    fetch("/api/users/assignable")
      .then((r) => r.json())
      .then((d) => setStaff(d.users ?? []));
  }, []);

  async function save() {
    if (!financeProjectId || !employeeUserId) {
      onFlash("Select project and employee", true);
      return;
    }
    const res = await fetch("/api/payroll-allocations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeUserId,
        financeProjectId,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        percent: parseFloat(percent),
      }),
    });
    if (res.ok) onFlash("Payroll allocation saved");
    else {
      const d = await res.json();
      onFlash(d.error ?? "Failed", true);
    }
  }

  return (
    <Card className="max-w-md">
      <CardTitle className="mb-4 text-base">Monthly effort allocation</CardTitle>
      <p className="mb-4 text-sm text-slate-500">
        Split salary cost across grants for {now.toLocaleString("en-IN", { month: "long", year: "numeric" })}.
      </p>
      <div className="space-y-3">
        <div>
          <Label>Staff member</Label>
          <Select className="mt-1" value={employeeUserId} onChange={(e) => setEmployeeUserId(e.target.value)}>
            <option value="">Select…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>% on this project</Label>
          <Input type="number" min={0} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} />
        </div>
        <Button type="button" variant="teal" onClick={save}>
          Save allocation
        </Button>
      </div>
    </Card>
  );
}

function LogframeSection({
  financeProjectId,
  onFlash,
}: {
  financeProjectId: string;
  onFlash: (msg: string, err?: boolean) => void;
}) {
  const [rows, setRows] = useState<MeIndicatorRow[]>([]);

  const load = useCallback(async () => {
    if (!financeProjectId) return;
    const res = await fetch(`/api/logframe?financeProjectId=${financeProjectId}&snapshot=1`);
    if (res.ok) setRows((await res.json()).rows ?? []);
  }, [financeProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardTitle className="mb-4 text-base">M&E indicators (logframe)</CardTitle>
      {!financeProjectId ? (
        <p className="text-sm text-slate-500">Select a finance project.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No logframe — sync project from Grant workflow first.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">Milestone</th>
                <th className="py-2 pr-4">Indicator</th>
                <th className="py-2 pr-4">Target</th>
                <th className="py-2 pr-4">Actual</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{r.milestoneName}</td>
                  <td className="py-2 pr-4">{r.kpiName}</td>
                  <td className="py-2 pr-4">{r.target}</td>
                  <td className="py-2 pr-4">{r.actual}</td>
                  <td className="py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${RAG_STYLES[r.status]}`}>
                      {RAG_LABELS[r.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function PublicImpactSection({
  financeProjectId,
  onFlash,
  meta,
}: {
  financeProjectId: string;
  onFlash: (msg: string, err?: boolean) => void;
  meta: ReturnType<typeof useFinanceMeta>["meta"];
}) {
  const [summary, setSummary] = useState("");
  const [publish, setPublish] = useState(false);
  const legacyId = meta?.financeProjects.find((p) => p.id === financeProjectId)?.legacyProjectId;

  async function save() {
    if (!financeProjectId) return;
    const res = await fetch("/api/public-impact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        financeProjectId,
        legacyProjectId: legacyId,
        isPublished: publish,
        summary,
        showBudget: true,
        showBeneficiaries: true,
      }),
    });
    if (res.ok) {
      onFlash(publish ? "Public impact page published" : "Draft saved");
    } else onFlash("Failed to save", true);
  }

  return (
    <Card className="max-w-lg">
      <CardTitle className="mb-4 text-base">Public transparency page</CardTitle>
      <p className="mb-4 text-sm text-slate-500">
        Aggregated impact data (no PII). {legacyId && publish && (
          <a className="text-brand-teal underline" href={`/impact/${legacyId}`} target="_blank" rel="noreferrer">
            Preview page
          </a>
        )}
      </p>
      <div className="space-y-3">
        <div>
          <Label>Summary</Label>
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          Publish publicly
        </label>
        <Button type="button" variant="teal" onClick={save}>
          Save
        </Button>
      </div>
    </Card>
  );
}
