"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PageHeader, PageShell } from "@/components/ui/PageHeader";
import { AddExpenseForm } from "@/components/finance/AddExpenseForm";
import { MyExpensesPanel } from "@/components/finance/ExpenseList";
import { ExpenseApprovalPanel } from "@/components/finance/ExpenseApprovalPanel";
import { ConveyanceExportPanel } from "@/components/finance/ConveyanceExportPanel";
import { DonationsPanel } from "@/components/finance/DonationsPanel";
import { AccountingPanel } from "@/components/finance/AccountingPanel";
import { VendorsPanel } from "@/components/finance/VendorsPanel";
import { BankingPanel } from "@/components/finance/BankingPanel";
import { FinancialReportsPanel } from "@/components/finance/FinancialReportsPanel";
import { PeriodClosePanel } from "@/components/finance/PeriodClosePanel";
import { ComplianceExportsPanel } from "@/components/finance/ComplianceExportsPanel";
import { ProjectBudgetPanel } from "@/components/finance/ProjectBudgetPanel";
import { BudgetVsActualPanel } from "@/components/finance/BudgetVsActualPanel";
import { InterFundPanel } from "@/components/finance/InterFundPanel";
import { PayrollJournalsPanel } from "@/components/finance/PayrollJournalsPanel";

type FinanceTab =
  | "add"
  | "my"
  | "approvals"
  | "conveyance"
  | "donations"
  | "accounting"
  | "vendors"
  | "banking"
  | "reports"
  | "periods"
  | "compliance"
  | "budget"
  | "budget_actual"
  | "inter_fund"
  | "payroll";

interface FinanceViewProps {
  userName: string;
  canSubmit: boolean;
  canApprove: boolean;
  canAccounting: boolean;
  canVendors: boolean;
  canBanking: boolean;
  canReports: boolean;
  canPeriodClose: boolean;
  canCompliance: boolean;
  canBudget: boolean;
  canDonations: boolean;
  canInterFund: boolean;
  canBudgetActual: boolean;
  isAdmin?: boolean;
}

export function FinanceView({
  userName,
  canSubmit,
  canApprove,
  canAccounting,
  canVendors,
  canBanking,
  canReports,
  canPeriodClose,
  canCompliance,
  canBudget,
  canDonations,
  canInterFund,
  canBudgetActual,
  isAdmin,
}: FinanceViewProps) {
  const defaultTab: FinanceTab = canAccounting
    ? "accounting"
    : canSubmit
      ? "add"
      : canApprove
        ? "approvals"
        : "my";
  const [tab, setTab] = useState<FinanceTab>(defaultTab);
  const [flash, setFlash] = useState<{ msg: string; error?: boolean } | null>(null);

  function onFlash(msg: string, isError?: boolean) {
    setFlash({ msg, error: isError });
    setTimeout(() => setFlash(null), 4000);
  }

  const tabs: Array<{ id: FinanceTab; label: string; show: boolean }> = [
    { id: "accounting", label: "Accounting", show: canAccounting },
    { id: "reports", label: "Reports", show: canReports },
    { id: "vendors", label: "Vendors", show: canVendors },
    { id: "banking", label: "Banking", show: canBanking },
    { id: "budget", label: "Projects", show: canBudget },
    { id: "budget_actual", label: "Budget vs actual", show: canBudgetActual },
    { id: "inter_fund", label: "Inter-fund", show: canInterFund },
    { id: "payroll", label: "Payroll GL", show: canAccounting },
    { id: "compliance", label: "Compliance", show: canCompliance },
    { id: "periods", label: "Period close", show: canPeriodClose },
    { id: "add", label: "Submit expense", show: canSubmit },
    { id: "my", label: "My expenses", show: canSubmit },
    { id: "approvals", label: "Approve", show: canApprove },
    { id: "conveyance", label: "Travel sheet", show: canSubmit || canApprove },
    { id: "donations", label: "Donations", show: canDonations },
  ];

  const isAccountingTab = [
    "accounting",
    "vendors",
    "banking",
    "reports",
    "periods",
    "compliance",
    "budget",
    "budget_actual",
    "inter_fund",
    "payroll",
  ].includes(tab);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Finance"
        title={isAccountingTab ? "Accounting & compliance" : "Expenses & donations"}
        description={
          isAccountingTab
            ? "Full NGO accounting — general ledger, fund accounting, bank reconciliation, and statutory exports."
            : "Submit bills, track approvals, and download monthly travel expense sheets."
        }
      />

      {flash && (
        <div
          className={cn(
            "mb-4 rounded-lg px-4 py-3 text-sm font-medium",
            flash.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          )}
        >
          {flash.msg}
        </div>
      )}

      <div className="tab-bar-mobile mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] sm:px-4",
                tab === t.id
                  ? "border-brand-teal text-brand-teal"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === "accounting" && canAccounting && <AccountingPanel onFlash={onFlash} />}
      {tab === "vendors" && canVendors && <VendorsPanel onFlash={onFlash} />}
      {tab === "banking" && canBanking && <BankingPanel onFlash={onFlash} />}
      {tab === "reports" && canReports && <FinancialReportsPanel />}
      {tab === "periods" && canPeriodClose && (
        <PeriodClosePanel onFlash={onFlash} isAdmin={isAdmin} />
      )}
      {tab === "compliance" && canCompliance && <ComplianceExportsPanel />}
      {tab === "budget" && canBudget && <ProjectBudgetPanel onFlash={onFlash} />}
      {tab === "budget_actual" && canBudgetActual && <BudgetVsActualPanel />}
      {tab === "inter_fund" && canInterFund && <InterFundPanel onFlash={onFlash} />}
      {tab === "payroll" && canAccounting && <PayrollJournalsPanel />}

      {tab === "add" && canSubmit && (
        <AddExpenseForm onSuccess={(msg) => onFlash(msg)} onError={(msg) => onFlash(msg, true)} />
      )}

      {tab === "my" && canSubmit && <MyExpensesPanel />}

      {tab === "approvals" && canApprove && <ExpenseApprovalPanel onFlash={onFlash} />}

      {tab === "conveyance" && (canSubmit || canApprove) && (
        <ConveyanceExportPanel userName={userName} canViewAll={canApprove} />
      )}

      {tab === "donations" && canDonations && <DonationsPanel onFlash={onFlash} />}
    </PageShell>
  );
}
