import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { getBudgetVsActualReport } from "@/lib/budget-vs-actual-db";
import { getMilestoneBudgetVsActual } from "@/lib/ngo-finance-workflow";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.budget")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const view = searchParams.get("view");

  if (view === "milestones") {
    const rows = await getMilestoneBudgetVsActual(prisma, projectId);
    return NextResponse.json({ milestones: rows });
  }

  const data = await getBudgetVsActualReport(prisma, projectId);
  return NextResponse.json({ data });
}
