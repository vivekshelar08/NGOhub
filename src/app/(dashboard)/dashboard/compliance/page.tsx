import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ComplianceView } from "@/components/compliance/ComplianceView";

export default async function CompliancePage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "financial_reports")) {
    redirect("/dashboard");
  }
  return (
    <div className="page-shell">
      <ComplianceView />
    </div>
  );
}
