import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ReportsView } from "@/components/reports/ReportsView";

export default async function ReportsPage() {
  const user = await getCurrentUser();

  if (!user || !hasFeature(user.role, "reports.view")) {
    redirect("/dashboard");
  }

  const canExport = hasFeature(user.role, "reports.export");

  return (
    <div className="p-6 md:p-8">
      <Suspense fallback={<div className="text-sm text-slate-500">Loading reports…</div>}>
        <ReportsView canExport={canExport} userId={user.id} />
      </Suspense>
    </div>
  );
}
