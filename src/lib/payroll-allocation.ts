import { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AllocationInput {
  employeeUserId: string;
  financeProjectId: string;
  month: number;
  year: number;
  percent: number;
  notes?: string;
}

export async function upsertPayrollAllocation(prisma: Db, input: AllocationInput) {
  const total = await prisma.payrollProjectAllocation.aggregate({
    where: {
      employeeUserId: input.employeeUserId,
      month: input.month,
      year: input.year,
      NOT: { financeProjectId: input.financeProjectId },
    },
    _sum: { percent: true },
  });
  const other = Number(total._sum.percent ?? 0);
  if (other + input.percent > 100.01) {
    throw new Error(`Allocation exceeds 100% (other projects: ${other}%)`);
  }

  return prisma.payrollProjectAllocation.upsert({
    where: {
      employeeUserId_financeProjectId_month_year: {
        employeeUserId: input.employeeUserId,
        financeProjectId: input.financeProjectId,
        month: input.month,
        year: input.year,
      },
    },
    create: input,
    update: { percent: input.percent, notes: input.notes },
    include: {
      financeProject: { select: { code: true, name: true } },
      employee: { select: { id: true, name: true } },
    },
  });
}

export async function getMonthlyAllocations(
  prisma: Db,
  month: number,
  year: number,
  employeeUserId?: string
) {
  return prisma.payrollProjectAllocation.findMany({
    where: {
      month,
      year,
      ...(employeeUserId ? { employeeUserId } : {}),
    },
    include: {
      financeProject: { select: { id: true, code: true, name: true } },
      employee: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ employee: { name: "asc" } }, { financeProject: { code: "asc" } }],
  });
}

/** Split net pay across projects for GL posting reference. */
export function splitPayByAllocation(
  netPay: number,
  allocations: Array<{ financeProjectId: string; percent: number }>
) {
  if (!allocations.length) return [{ financeProjectId: null as string | null, amount: netPay }];
  const totalPct = allocations.reduce((s, a) => s + a.percent, 0);
  if (totalPct <= 0) return [{ financeProjectId: null, amount: netPay }];

  return allocations.map((a) => ({
    financeProjectId: a.financeProjectId,
    amount: Math.round((netPay * a.percent) / 100 * 100) / 100,
  }));
}
