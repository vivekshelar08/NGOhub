import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ServicePortalView } from "@/components/services/ServicePortalView";

function BeneficiariesLoading() {
  return <div className="page-shell text-sm text-slate-500">Loading…</div>;
}

export default async function BeneficiariesPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; tab?: string }>;
}) {
  const user = await getCurrentUser();
  const { projectId, tab } = await searchParams;

  if (!user || !hasFeature(user.role, "beneficiaries.list")) {
    redirect("/dashboard");
  }

  const canManageServices = hasFeature(user.role, "services.manage");

  return (
    <div className="page-shell">
      <Suspense fallback={<BeneficiariesLoading />}>
        <ServicePortalView
          userId={user.id}
          userRole={user.role}
          userName={user.name}
          canManageServices={canManageServices}
          initialProjectId={projectId}
          initialTab={tab}
        />
      </Suspense>
    </div>
  );
}
