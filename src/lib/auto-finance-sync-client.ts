import { ProjectProposal, computeBudgetTotals, budgetAdminInputFromProject } from "@/lib/projects";

/** After project approval, create linked finance project + logframe on server. */
export async function syncApprovedProjectToFinance(project: ProjectProposal) {
  const totals = computeBudgetTotals(project.budget ?? [], budgetAdminInputFromProject(project));
  const milestones = project.setup?.milestones?.map((m) => ({
    id: m.id,
    name: m.name,
    budgetPercent: m.budgetPercent ?? 0,
    kpis: (m.kpis ?? []).map((k) => ({
      name: k.name,
      activityCount: k.activityCount,
      beneficiaryCount: k.beneficiaryCount,
      achievedActivityCount: k.achievedActivityCount,
      achievedBeneficiaryCount: k.achievedBeneficiaries,
    })),
  }));

  const res = await fetch("/api/ngo-integrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "auto_finance_project",
      legacyProjectId: project.id,
      title: project.title,
      totalBudget: totals.totalEvaluation,
      donorId: project.donorIds?.[0],
      fundingType: project.fundingType,
      milestones,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Finance sync failed");
  }
  return res.json() as Promise<{ financeProjectId: string; code: string; created: boolean }>;
}
