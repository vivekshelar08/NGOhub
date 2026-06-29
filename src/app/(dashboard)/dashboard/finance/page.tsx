import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { hasPermission } from "@/lib/rbac";
import { FinanceView } from "@/components/finance/FinanceView";

export default async function FinancePage() {
  const user = await getCurrentUser();

  if (!user || !hasFeature(user.role, "finance.view")) {
    redirect("/dashboard");
  }

  return (
    <FinanceView
      userName={user.name}
      canSubmit={hasFeature(user.role, "finance.submit")}
      canApprove={hasFeature(user.role, "finance.approve")}
      canAccounting={hasFeature(user.role, "finance.accounting")}
      canVendors={hasFeature(user.role, "finance.vendors")}
      canBanking={hasFeature(user.role, "finance.banking")}
      canReports={hasFeature(user.role, "finance.reports")}
      canPeriodClose={hasFeature(user.role, "finance.period_close")}
      canCompliance={hasFeature(user.role, "finance.compliance")}
      canBudget={hasFeature(user.role, "finance.budget")}
      canDonations={hasFeature(user.role, "finance.donations")}
      canInterFund={hasFeature(user.role, "finance.inter_fund")}
      canBudgetActual={hasFeature(user.role, "finance.budget_actual")}
      canModifyFinance={hasPermission(user.role, "modify_finance_records")}
      isAdmin={user.role === "ADMIN" || hasFeature(user.role, "admin.access")}
    />
  );
}
