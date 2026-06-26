import { PrismaClient } from "@/generated/prisma/client";

export async function getBudgetVsActualReport(prisma: PrismaClient, financeProjectId?: string) {
  const projects = await prisma.financeProject.findMany({
    where: financeProjectId ? { id: financeProjectId } : { isActive: true },
    include: { budgetLines: { include: { fund: true } } },
    orderBy: { code: "asc" },
  });

  const results = [];
  for (const project of projects) {
    const lines = [];
    for (const bl of project.budgetLines) {
      const actual = await prisma.expense.aggregate({
        where: {
          financeProjectId: project.id,
          budgetHead: bl.budgetHead,
          status: "APPROVED",
        },
        _sum: { amount: true },
      });
      const pending = await prisma.expense.aggregate({
        where: {
          financeProjectId: project.id,
          budgetHead: bl.budgetHead,
          status: "PENDING",
        },
        _sum: { amount: true },
      });
      const budget = Number(bl.amount);
      const spent = Number(actual._sum.amount ?? 0);
      const committed = Number(pending._sum.amount ?? 0);
      lines.push({
        budgetHead: bl.budgetHead,
        fund: bl.fund?.code ?? null,
        budget,
        actual: spent,
        pending: committed,
        remaining: budget - spent - committed,
        utilizationPercent: budget > 0 ? ((spent + committed) / budget) * 100 : 0,
      });
    }
    results.push({
      projectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      totalBudget: project.totalBudget ? Number(project.totalBudget) : null,
      lines,
    });
  }
  return results;
}
