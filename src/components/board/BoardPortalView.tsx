"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Shield, Users } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { PageHeader, PageShell } from "@/components/ui/PageHeader";

interface BoardStats {
  beneficiaries: number;
  donationsTotal: number;
  complianceDue: number;
  openIncidents: number;
  activeVolunteers: number;
}

export function BoardPortalView() {
  const [stats, setStats] = useState<BoardStats | null>(null);

  useEffect(() => {
    async function load() {
      const [benRes, donRes, compRes, safeRes, volRes] = await Promise.all([
        fetch("/api/beneficiaries?countOnly=1"),
        fetch("/api/donations"),
        fetch("/api/compliance"),
        fetch("/api/safeguarding"),
        fetch("/api/volunteers"),
      ]);

      const beneficiaries = benRes.ok ? (await benRes.json()).count ?? 0 : 0;
      const donations = donRes.ok ? (await donRes.json()).donations ?? [] : [];
      const compliance = compRes.ok ? (await compRes.json()).items ?? [] : [];
      const incidents = safeRes.ok ? (await safeRes.json()).incidents ?? [] : [];
      const volunteers = volRes.ok ? (await volRes.json()).volunteers ?? [] : [];

      setStats({
        beneficiaries,
        donationsTotal: donations.reduce((s: number, d: { amount: number }) => s + Number(d.amount), 0),
        complianceDue: compliance.filter((c: { status: string }) => c.status === "DUE" || c.status === "OVERDUE").length,
        openIncidents: incidents.filter((i: { status: string }) => i.status === "OPEN").length,
        activeVolunteers: volunteers.filter((v: { isActive: boolean }) => v.isActive).length,
      });
    }
    load();
  }, []);

  const tiles = stats
    ? [
        { label: "People served", value: stats.beneficiaries.toLocaleString("en-IN"), icon: Users },
        { label: "Donations (recorded)", value: `₹${stats.donationsTotal.toLocaleString("en-IN")}`, icon: BarChart3 },
        { label: "Compliance items due", value: String(stats.complianceDue), icon: Shield },
        { label: "Active volunteers", value: String(stats.activeVolunteers), icon: Users },
      ]
    : [];

  return (
    <PageShell>
      <PageHeader
        title="Board portal"
        description="Read-only overview for trustees and board members — no operational actions."
      />

      {!stats ? (
        <p className="text-sm text-slate-500">Loading summary…</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <div className="flex items-start justify-between">
                  <div>
                    <CardDescription>{label}</CardDescription>
                    <CardTitle className="mt-1 text-2xl">{value}</CardTitle>
                  </div>
                  <Icon className="h-5 w-5 text-brand-teal/60" />
                </div>
              </Card>
            ))}
          </div>

          {stats.openIncidents > 0 && (
            <Card className="mb-6 border-amber-200 bg-amber-50">
              <p className="text-sm text-amber-900">
                {stats.openIncidents} open safeguarding incident(s) require board attention.
              </p>
            </Card>
          )}

          <Card>
            <CardTitle className="text-base">Quick links</CardTitle>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/dashboard/reports" className="text-brand-teal hover:underline">Impact reports</Link></li>
              <li><Link href="/dashboard/compliance" className="text-brand-teal hover:underline">Compliance calendar</Link></li>
              <li><Link href="/dashboard/projects" className="text-brand-teal hover:underline">Approved projects</Link></li>
            </ul>
          </Card>
        </>
      )}
    </PageShell>
  );
}
