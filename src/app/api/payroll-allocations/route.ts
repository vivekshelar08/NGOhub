import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { getMonthlyAllocations, upsertPayrollAllocation } from "@/lib/payroll-allocation";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const employeeUserId = searchParams.get("employeeUserId") ?? undefined;

  const allocations = await getMonthlyAllocations(prisma, month, year, employeeUserId);
  return NextResponse.json({
    allocations: allocations.map((a) => ({
      ...a,
      percent: Number(a.percent),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = z
    .object({
      employeeUserId: z.string(),
      financeProjectId: z.string(),
      month: z.number().int().min(1).max(12),
      year: z.number().int(),
      percent: z.number().min(0).max(100),
      notes: z.string().optional(),
    })
    .safeParse(await request.json());

  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const row = await upsertPayrollAllocation(prisma, parsed.data);
    return NextResponse.json({ allocation: { id: row.id, percent: Number(row.percent) } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
